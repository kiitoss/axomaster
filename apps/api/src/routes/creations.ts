import { Hono } from 'hono'
import {
  cardSchema,
  creationQuota,
  creationWindowStart,
  type Card,
  type CreationQuotaInfo,
  type MyCreation,
  type MyCreations,
  type SessionUser,
  type Settings,
} from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { requireUser } from '../lib/auth'
import { isConstraintError, parseCard, type CardRow } from '../lib/db'
import { HttpError, nowIso, readJson } from '../lib/http'
import { loadSettings } from '../lib/settings'

/**
 * Cartes proposées par un joueur : elles arrivent en brouillon chez l'admin, qui les publie ou
 * les refuse. Le joueur les voit toutes ici (c'est son œuvre), mais une fois publiées elles
 * suivent la règle commune : face cachée dans son catalogue tant qu'il ne les a pas tirées.
 */

/** Limite pratique des admins, qui ne sont pas soumis au quota. */
const UNLIMITED = 1_000_000

function toMyCreation(row: CardRow): MyCreation {
  return {
    card: parseCard(row),
    status: row.status === 'published' ? 'published' : row.rejected_at ? 'rejected' : 'pending',
    reviewNote: row.review_note,
    publishedAt: row.published_at,
  }
}

async function quotaFor(
  db: D1Database,
  user: SessionUser,
  settings: Settings,
): Promise<CreationQuotaInfo> {
  const { results } = await db
    .prepare('SELECT created_at FROM card_creations WHERE user_id = ? AND created_at > ?')
    .bind(user.id, creationWindowStart(settings))
    .all<{ created_at: string }>()
  const dates = results.map((r) => r.created_at)
  if (user.role === 'admin') {
    const quota = creationQuota(dates, { ...settings, creationLimit: UNLIMITED })
    return { ...quota, unlimited: true }
  }
  return { ...creationQuota(dates, settings), unlimited: false }
}

/** Champs que le joueur ne choisit pas : signature, numéro (attribué par l'admin), origine. */
function normalize(card: Card, user: SessionUser, number: number | null): Card {
  return { ...card, author: user.displayName, number, source: { kind: 'local' } }
}

export const creationRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const user = c.get('user')
    const settings = await loadSettings(c.env.DB)
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM cards WHERE created_by = ? ORDER BY updated_at DESC',
    )
      .bind(user.id)
      .all<CardRow>()
    const body: MyCreations = {
      quota: await quotaFor(c.env.DB, user, settings),
      cards: results.map(toMyCreation),
    }
    return c.json(body)
  })

  /** Crée (en consommant un crédit) ou modifie une proposition encore en brouillon. */
  .put('/:id', async (c) => {
    const input = await readJson(c, cardSchema)
    const id = c.req.param('id')
    if (input.id !== id) throw new HttpError(400, 'Identifiant de carte incohérent')
    const user = c.get('user')
    const db = c.env.DB

    const existing = await db
      .prepare('SELECT created_by, status, number FROM cards WHERE id = ?')
      .bind(id)
      .first<Pick<CardRow, 'created_by' | 'status' | 'number'>>()

    if (existing) {
      if (existing.created_by !== user.id) throw new HttpError(404, 'Carte introuvable')
      // Une modification vaut nouvelle soumission : le refus éventuel est effacé.
      const card = normalize(input, user, existing.number)
      const result = await db
        .prepare(
          `UPDATE cards SET data = ?, category_id = ?, rarity = ?, updated_at = ?,
             rejected_at = NULL, review_note = NULL
           WHERE id = ? AND created_by = ? AND status = 'draft'`,
        )
        .bind(JSON.stringify(card), card.categoryId, card.rarity, card.updatedAt, id, user.id)
        .run()
      if (!result.meta.changes)
        throw new HttpError(409, 'Cette carte est déjà validée : elle ne peut plus être modifiée')
    } else {
      const settings = await loadSettings(db)
      const admin = user.role === 'admin'
      if (!admin && settings.creationLimit <= 0)
        throw new HttpError(403, 'La création de cartes est fermée pour le moment')
      const limit = admin ? UNLIMITED : settings.creationLimit
      const card = normalize(input, user, null)
      const now = nowIso()
      // Le quota est revérifié dans les deux insertions, exécutées dans la même transaction :
      // deux créations simultanées ne peuvent pas dépasser la limite.
      const underLimit =
        '(SELECT COUNT(*) FROM card_creations WHERE user_id = ? AND created_at > ?) < ?'
      const quotaArgs = [user.id, creationWindowStart(settings), limit]
      let inserted: number
      try {
        const [result] = await db.batch([
          db
            .prepare(
              `INSERT INTO cards (id, data, category_id, rarity, number, updated_at, created_by)
               SELECT ?, ?, ?, ?, NULL, ?, ? WHERE ${underLimit}`,
            )
            .bind(
              id,
              JSON.stringify(card),
              card.categoryId,
              card.rarity,
              card.updatedAt,
              user.id,
              ...quotaArgs,
            ),
          db
            .prepare(
              `INSERT INTO card_creations (user_id, card_id, created_at)
               SELECT ?, ?, ? WHERE ${underLimit}`,
            )
            .bind(user.id, id, now, ...quotaArgs),
        ])
        inserted = result?.meta.changes ?? 0
      } catch (err) {
        if (isConstraintError(err)) throw new HttpError(409, 'Identifiant de carte déjà utilisé')
        throw err
      }
      if (!inserted) {
        const quota = await quotaFor(db, user, settings)
        throw new HttpError(
          429,
          `Limite atteinte : ${quota.limit} carte${quota.limit > 1 ? 's' : ''} par période. Réessayez plus tard.`,
        )
      }
    }

    const row = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first<CardRow>()
    if (!row) throw new HttpError(404, 'Carte introuvable')
    return c.json(toMyCreation(row))
  })

  /** Retire une proposition non publiée ; le crédit consommé n'est pas rendu. */
  .delete('/:id', async (c) => {
    const result = await c.env.DB.prepare(
      "DELETE FROM cards WHERE id = ? AND created_by = ? AND status = 'draft'",
    )
      .bind(c.req.param('id'), c.get('user').id)
      .run()
    if (!result.meta.changes) throw new HttpError(404, 'Carte introuvable ou déjà validée')
    return c.body(null, 204)
  })
