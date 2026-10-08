import { Hono } from 'hono'
import { z } from 'zod'
import {
  boosterSettingsSchema,
  cardImageIds,
  cardSchema,
  cardStatusSchema,
  categorySchema,
  createUserRequestSchema,
  giftBoostersRequestSchema,
  importRequestSchema,
  initialBoosterAnchor,
  newId,
  updateUserRequestSchema,
  type AdminUser,
} from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { requireAdmin, toSessionUser, type UserRow } from '../lib/auth'
import {
  getAdminCard,
  ownedCards,
  parseCard,
  toAdminCard,
  upsertCard,
  type CardRow,
} from '../lib/db'
import { HttpError, nowIso, placeholders, readJson } from '../lib/http'
import { imageStorage, MAX_IMAGE_BYTES } from '../lib/images'
import { hashPassword } from '../lib/password'
import { loadSettings, saveSettings } from '../lib/settings'

const statusRequestSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
  status: cardStatusSchema,
})

const categoryInputSchema = categorySchema.omit({ id: true }).extend({
  name: z.string().trim().min(1).max(80),
})

/** Délai avant qu'une image non référencée soit considérée comme orpheline. */
const IMAGE_GRACE_MS = 6 * 3600_000

export const adminRoutes = new Hono<AppEnv>()
  .use(requireAdmin)

  // ---------- Cartes ----------

  .get('/cards', async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM cards ORDER BY updated_at DESC',
    ).all<CardRow>()
    return c.json(results.map(toAdminCard))
  })
  .put('/cards/:id', async (c) => {
    const card = await readJson(c, cardSchema)
    if (card.id !== c.req.param('id')) throw new HttpError(400, 'Identifiant de carte incohérent')
    await upsertCard(c.env.DB, card).run()
    return c.json(await getAdminCard(c.env.DB, card.id))
  })
  .delete('/cards/:id', async (c) => {
    // Les exemplaires des joueurs et les échanges en cours disparaissent avec la carte (cascade).
    await c.env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(c.req.param('id')).run()
    return c.body(null, 204)
  })
  .post('/cards/status', async (c) => {
    const { ids, status } = await readJson(c, statusRequestSchema)
    const now = nowIso()
    const statements = []
    for (let i = 0; i < ids.length; i += 90) {
      const chunk = ids.slice(i, i + 90)
      statements.push(
        c.env.DB.prepare(
          `UPDATE cards SET status = ?, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE NULL END
           WHERE id IN (${placeholders(chunk.length)})`,
        ).bind(status, status, now, ...chunk),
      )
    }
    await c.env.DB.batch(statements)
    return c.json({ updated: ids.length })
  })
  .post('/import', async (c) => {
    const { categories, cards } = await readJson(c, importRequestSchema)
    const db = c.env.DB
    const statements = [
      ...categories.map((cat, i) =>
        db
          .prepare(
            `INSERT INTO categories (id, name, color, position)
             VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 + ? FROM categories))
             ON CONFLICT (id) DO NOTHING`,
          )
          .bind(cat.id, cat.name, cat.color, i),
      ),
      ...cards.map((card) => upsertCard(db, card)),
    ]
    for (let i = 0; i < statements.length; i += 100) await db.batch(statements.slice(i, i + 100))
    return c.json({ categories: categories.length, cards: cards.length })
  })

  // ---------- Catégories ----------

  .post('/categories', async (c) => {
    const input = await readJson(c, categoryInputSchema)
    const category = { id: newId(), ...input }
    await c.env.DB.prepare(
      'INSERT INTO categories (id, name, color, position) VALUES (?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1 FROM categories))',
    )
      .bind(category.id, category.name, category.color)
      .run()
    return c.json(category, 201)
  })
  .put('/categories/:id', async (c) => {
    const input = await readJson(c, categoryInputSchema)
    const id = c.req.param('id')
    const result = await c.env.DB.prepare('UPDATE categories SET name = ?, color = ? WHERE id = ?')
      .bind(input.name, input.color, id)
      .run()
    if (!result.meta.changes) throw new HttpError(404, 'Collection introuvable')
    return c.json({ id, ...input })
  })
  .delete('/categories/:id', async (c) => {
    const id = c.req.param('id')
    const now = nowIso()
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE cards SET category_id = NULL, updated_at = ?,
           data = json_set(data, '$.categoryId', json('null'), '$.updatedAt', ?)
         WHERE category_id = ?`,
      ).bind(now, now, id),
      c.env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id),
    ])
    return c.body(null, 204)
  })

  // ---------- Joueurs ----------

  .get('/users', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT u.*,
         COALESCE(SUM(CASE WHEN uc.quantity > 0 THEN 1 ELSE 0 END), 0) AS distinct_cards,
         COALESCE(SUM(uc.quantity), 0) AS total_cards
       FROM users u LEFT JOIN user_cards uc ON uc.user_id = u.id
       GROUP BY u.id ORDER BY u.display_name COLLATE NOCASE`,
    ).all<UserRow & { distinct_cards: number; total_cards: number }>()
    return c.json(
      results.map((row): AdminUser => ({
        ...toSessionUser(row),
        disabled: !!row.disabled,
        createdAt: row.created_at,
        bonusBoosters: row.bonus_boosters,
        distinctCards: row.distinct_cards,
        totalCards: row.total_cards,
      })),
    )
  })
  .post('/users', async (c) => {
    const input = await readJson(c, createUserRequestSchema)
    const settings = await loadSettings(c.env.DB)
    const id = newId()
    try {
      await c.env.DB.prepare(
        `INSERT INTO users (id, username, display_name, role, password_hash, booster_anchor, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(
          id,
          input.username,
          input.displayName,
          input.role,
          await hashPassword(input.password),
          initialBoosterAnchor(settings),
          nowIso(),
        )
        .run()
    } catch (err) {
      if (err instanceof Error && /UNIQUE/i.test(err.message))
        throw new HttpError(409, 'Cet identifiant est déjà utilisé')
      throw err
    }
    return c.json(
      { id, username: input.username, displayName: input.displayName, role: input.role },
      201,
    )
  })
  .patch('/users/:id', async (c) => {
    const input = await readJson(c, updateUserRequestSchema)
    const id = c.req.param('id')
    if (id === c.get('user').id && (input.role === 'player' || input.disabled))
      throw new HttpError(400, 'Vous ne pouvez pas retirer vos propres droits')

    const fields: [column: string, value: string | number][] = []
    if (input.displayName !== undefined) fields.push(['display_name', input.displayName])
    if (input.role !== undefined) fields.push(['role', input.role])
    if (input.disabled !== undefined) fields.push(['disabled', input.disabled ? 1 : 0])
    if (input.password !== undefined)
      fields.push(['password_hash', await hashPassword(input.password)])
    if (!fields.length) throw new HttpError(400, 'Rien à modifier')

    const statements = [
      c.env.DB.prepare(
        `UPDATE users SET ${fields.map(([column]) => `${column} = ?`).join(', ')} WHERE id = ?`,
      ).bind(...fields.map(([, value]) => value), id),
    ]
    // Un mot de passe changé ou un compte désactivé ferme les sessions ouvertes.
    if (input.password !== undefined || input.disabled)
      statements.push(c.env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id))
    const [result] = await c.env.DB.batch(statements)
    if (!result?.meta.changes) throw new HttpError(404, 'Utilisateur introuvable')
    return c.body(null, 204)
  })
  .get('/users/:id/cards', async (c) => c.json(await ownedCards(c.env.DB, c.req.param('id'))))

  // ---------- Boosters ----------

  .get('/settings', async (c) => c.json(await loadSettings(c.env.DB)))
  .put('/settings', async (c) => {
    const settings = await readJson(c, boosterSettingsSchema)
    await saveSettings(c.env.DB, settings)
    return c.json(settings)
  })
  .post('/boosters/gift-all', async (c) => {
    const { count } = await readJson(c, giftBoostersRequestSchema)
    const result = await c.env.DB.prepare(
      'UPDATE users SET bonus_boosters = bonus_boosters + ? WHERE disabled = 0',
    )
      .bind(count)
      .run()
    return c.json({ players: result.meta.changes })
  })

  // ---------- Images ----------

  .post('/images', async (c) => uploadImage(c.env, newId(), c.req.raw))
  .put('/images/:id', async (c) => uploadImage(c.env, c.req.param('id'), c.req.raw))
  .post('/images/gc', async (c) => {
    const { results } =
      await c.env.DB.prepare('SELECT data FROM cards').all<Pick<CardRow, 'data'>>()
    const used = new Set(results.flatMap((row) => cardImageIds(parseCard(row))))
    const storage = imageStorage(c.env)
    const orphans = (await storage.listOlderThan(new Date(Date.now() - IMAGE_GRACE_MS))).filter(
      (id) => !used.has(id),
    )
    await storage.delete(orphans)
    return c.json({ deleted: orphans.length })
  })

async function uploadImage(env: AppEnv['Bindings'], id: string, request: Request) {
  if (!/^[\w-]{1,100}$/.test(id)) throw new HttpError(400, 'Identifiant d’image invalide')
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) throw new HttpError(400, 'Le fichier doit être une image')
  const data = await request.arrayBuffer()
  if (!data.byteLength) throw new HttpError(400, 'Image vide')
  if (data.byteLength > MAX_IMAGE_BYTES)
    throw new HttpError(413, 'Image trop lourde (1,8 Mo maximum)')
  await imageStorage(env).put(id, data, contentType)
  return Response.json({ id }, { status: 201 })
}
