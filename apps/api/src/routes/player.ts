import { Hono } from 'hono'
import {
  BOOSTER_POOL_ALL,
  boosterStock,
  consumeBooster,
  drawBooster,
  openBoosterRequestSchema,
  type BoosterOffer,
  type Boosters,
  type Card,
  type CatalogueEntry,
  type Category,
  type OpenBoosterResponse,
} from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { requireUser, type UserRow } from '../lib/auth'
import {
  inventoryDelta,
  isConstraintError,
  ownedCards,
  ownedQuantities,
  parseCard,
  type CardRow,
} from '../lib/db'
import { HttpError, readJson } from '../lib/http'
import { imageStorage } from '../lib/images'
import { loadSettings } from '../lib/settings'

async function listCategories(db: D1Database): Promise<Category[]> {
  const { results } = await db
    .prepare('SELECT id, name, color FROM categories ORDER BY position, name')
    .all<Category>()
  return results
}

async function publishedCards(db: D1Database): Promise<Card[]> {
  const { results } = await db
    .prepare("SELECT data FROM cards WHERE status = 'published'")
    .all<Pick<CardRow, 'data'>>()
  return results.map(parseCard)
}

async function quotaRow(db: D1Database, userId: string) {
  const row = await db
    .prepare('SELECT booster_anchor, bonus_boosters FROM users WHERE id = ?')
    .bind(userId)
    .first<Pick<UserRow, 'booster_anchor' | 'bonus_boosters'>>()
  if (!row) throw new HttpError(401, 'Connexion requise')
  return { anchor: row.booster_anchor, bonus: row.bonus_boosters }
}

export const playerRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/categories', async (c) => c.json(await listCategories(c.env.DB)))

  /** Toutes les cartes publiées ; celles que le joueur n'a pas restent face cachée. */
  .get('/catalogue', async (c) => {
    const { results } = await c.env.DB.prepare(
      `SELECT c.data, c.number, c.category_id, uc.quantity FROM cards c
       LEFT JOIN user_cards uc ON uc.card_id = c.id AND uc.user_id = ?
       WHERE c.status = 'published' OR uc.quantity > 0
       ORDER BY c.number IS NULL, c.number, c.id`,
    )
      .bind(c.get('user').id)
      .all<Pick<CardRow, 'data' | 'number' | 'category_id'> & { quantity: number | null }>()

    const entries = results.map((row): CatalogueEntry => {
      if (row.quantity) return { owned: true, card: parseCard(row), quantity: row.quantity }
      return {
        owned: false,
        id: parseCard(row).id,
        number: row.number,
        categoryId: row.category_id,
      }
    })
    return c.json({ categories: await listCategories(c.env.DB), entries })
  })

  .get('/boosters', async (c) => {
    const db = c.env.DB
    const [settings, quota, cards, categories] = await Promise.all([
      loadSettings(db),
      quotaRow(db, c.get('user').id),
      publishedCards(db),
      listCategories(db),
    ])
    const offers: BoosterOffer[] = []
    if (cards.length)
      offers.push({
        pool: BOOSTER_POOL_ALL,
        title: 'Toutes les cartes',
        color: '#a8832f',
        cardCount: cards.length,
      })
    for (const category of categories) {
      const count = cards.filter((card) => card.categoryId === category.id).length
      if (count)
        offers.push({
          pool: category.id,
          title: category.name,
          color: category.color,
          cardCount: count,
        })
    }
    const body: Boosters = { stock: boosterStock(quota, settings), size: settings.size, offers }
    return c.json(body)
  })

  .post('/boosters/open', async (c) => {
    const { pool } = await readJson(c, openBoosterRequestSchema)
    const db = c.env.DB
    const userId = c.get('user').id
    const now = new Date()
    const [settings, quota, published] = await Promise.all([
      loadSettings(db),
      quotaRow(db, userId),
      publishedCards(db),
    ])

    const consumed = consumeBooster(quota, settings, now)
    if (!consumed) throw new HttpError(409, 'Aucun booster disponible pour le moment')

    const candidates =
      pool === BOOSTER_POOL_ALL ? published : published.filter((card) => card.categoryId === pool)
    if (!candidates.length) throw new HttpError(404, 'Ce booster ne contient aucune carte')

    const cards = drawBooster(candidates, { size: settings.size })
    const before = await ownedQuantities(
      db,
      userId,
      cards.map((card) => card.id),
    )
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)

    const iso = now.toISOString()
    try {
      await db.batch([
        // Garde anti double-ouverture : si le quota a changé entre-temps, bonus_boosters passe à -1,
        // la contrainte CHECK échoue et rien n'est enregistré.
        db
          .prepare(
            `UPDATE users SET
               booster_anchor = CASE WHEN booster_anchor = ?1 AND bonus_boosters = ?2 THEN ?3 ELSE booster_anchor END,
               bonus_boosters = CASE WHEN booster_anchor = ?1 AND bonus_boosters = ?2 THEN ?4 ELSE -1 END
             WHERE id = ?5`,
          )
          .bind(quota.anchor, quota.bonus, consumed.state.anchor, consumed.state.bonus, userId),
        ...[...counts].flatMap(([cardId, n]) => inventoryDelta(db, userId, cardId, n, iso)),
        db
          .prepare(
            'INSERT INTO booster_openings (id, user_id, pool, card_ids, source, opened_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(
            crypto.randomUUID(),
            userId,
            pool,
            JSON.stringify(cards.map((card) => card.id)),
            consumed.source,
            iso,
          ),
      ])
    } catch (err) {
      if (isConstraintError(err))
        throw new HttpError(409, 'Ce booster vient déjà d’être ouvert, réessayez')
      throw err
    }

    const body: OpenBoosterResponse = {
      cards,
      newCardIds: [...counts.keys()].filter((id) => !before.get(id)),
      stock: boosterStock(consumed.state, settings, now),
    }
    return c.json(body)
  })

  // ---------- Joueurs (pour les échanges) ----------

  .get('/players', async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT id, display_name FROM users WHERE disabled = 0 AND id != ? ORDER BY display_name COLLATE NOCASE',
    )
      .bind(c.get('user').id)
      .all<{ id: string; display_name: string }>()
    return c.json(results.map((r) => ({ id: r.id, displayName: r.display_name })))
  })
  .get('/players/:id/cards', async (c) => c.json(await ownedCards(c.env.DB, c.req.param('id'))))
  .get('/inventory', async (c) => c.json(await ownedCards(c.env.DB, c.get('user').id)))

  // ---------- Images ----------

  .get('/images/:id', async (c) => {
    const image = await imageStorage(c.env).get(c.req.param('id'))
    if (!image) throw new HttpError(404, 'Image introuvable')
    return new Response(image.body, {
      headers: {
        'Content-Type': image.contentType,
        // Les identifiants d'images sont immuables (une nouvelle image = un nouvel id).
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    })
  })
