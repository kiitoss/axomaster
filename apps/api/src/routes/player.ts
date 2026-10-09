import { Hono } from 'hono'
import {
  boosterStock,
  consumeBooster,
  drawBooster,
  type Boosters,
  type Card,
  type CatalogueEntry,
  type Category,
  type Leaderboard,
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
  playerCardsFor,
  type CardRow,
} from '../lib/db'
import { HttpError } from '../lib/http'
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
    const [settings, quota, cards] = await Promise.all([
      loadSettings(db),
      quotaRow(db, c.get('user').id),
      publishedCards(db),
    ])
    const body: Boosters = {
      stock: boosterStock(quota, settings),
      size: settings.size,
      cardCount: cards.length,
    }
    return c.json(body)
  })

  .post('/boosters/open', async (c) => {
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

    if (!published.length) throw new HttpError(404, 'Aucune carte n’est encore en jeu')

    const cards = drawBooster(published, { size: settings.size })
    const before = await ownedQuantities(
      db,
      userId,
      cards.map((card) => card.id),
    )
    const counts = new Map<string, number>()
    for (const card of cards) counts.set(card.id, (counts.get(card.id) ?? 0) + 1)

    const iso = now.toISOString()
    const stock = boosterStock(consumed.state, settings, now)
    try {
      await db.batch([
        // Garde anti double-ouverture : si le quota a changé entre-temps, bonus_boosters passe à -1,
        // la contrainte CHECK échoue et rien n'est enregistré.
        db
          .prepare(
            `UPDATE users SET
               booster_anchor = CASE WHEN booster_anchor = ?1 AND bonus_boosters = ?2 THEN ?3 ELSE booster_anchor END,
               bonus_boosters = CASE WHEN booster_anchor = ?1 AND bonus_boosters = ?2 THEN ?4 ELSE -1 END,
               booster_notify_at = ?6
             WHERE id = ?5`,
          )
          .bind(
            quota.anchor,
            quota.bonus,
            consumed.state.anchor,
            consumed.state.bonus,
            userId,
            // Prochaine recharge à notifier (cf. jobs/boosterRefills.ts).
            stock.nextAt,
          ),
        ...[...counts].flatMap(([cardId, n]) => inventoryDelta(db, userId, cardId, n, iso)),
        db
          .prepare(
            'INSERT INTO booster_openings (id, user_id, pool, card_ids, source, opened_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .bind(
            crypto.randomUUID(),
            userId,
            // Colonne historique : il n'existe plus qu'un booster, tiré parmi toutes les cartes.
            'all',
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
      stock,
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
  .get('/players/:id/cards', async (c) =>
    c.json(await playerCardsFor(c.env.DB, c.req.param('id'), c.get('user').id)),
  )
  .get('/inventory', async (c) => c.json(await ownedCards(c.env.DB, c.get('user').id)))

  // ---------- Classement ----------

  /** Cartes publiées débloquées par chaque joueur actif (identifiants seulement). */
  .get('/leaderboard', async (c) => {
    const db = c.env.DB
    const [cards, owned, users] = await db.batch([
      db.prepare(
        `SELECT id, number, category_id FROM cards WHERE status = 'published'
         ORDER BY number IS NULL, number, id`,
      ),
      db.prepare(
        `SELECT uc.user_id, uc.card_id FROM user_cards uc
         JOIN cards c ON c.id = uc.card_id
         WHERE uc.quantity > 0 AND c.status = 'published'`,
      ),
      db.prepare('SELECT id, display_name FROM users WHERE disabled = 0'),
    ])
    const cardRows = (cards?.results ?? []) as {
      id: string
      number: number | null
      category_id: string | null
    }[]
    const ownedRows = (owned?.results ?? []) as { user_id: string; card_id: string }[]
    const userRows = (users?.results ?? []) as { id: string; display_name: string }[]

    const byUser = new Map<string, string[]>()
    for (const row of ownedRows) {
      const list = byUser.get(row.user_id)
      if (list) list.push(row.card_id)
      else byUser.set(row.user_id, [row.card_id])
    }
    const body: Leaderboard = {
      cards: cardRows.map((row) => ({
        id: row.id,
        number: row.number,
        categoryId: row.category_id,
      })),
      players: userRows
        .map((row) => ({
          id: row.id,
          displayName: row.display_name,
          owned: byUser.get(row.id) ?? [],
        }))
        .sort(
          (a, b) =>
            b.owned.length - a.owned.length ||
            a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' }),
        ),
    }
    return c.json(body)
  })

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
