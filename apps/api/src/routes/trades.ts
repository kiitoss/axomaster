import { Hono, type Context } from 'hono'
import {
  createTradeRequestSchema,
  tradeRequestNotification,
  tradeResolvedNotification,
  type Trade,
  type TradeOutcome,
  type TradeStatus,
} from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { requireUser } from '../lib/auth'
import {
  cardsByIds,
  inventoryDelta,
  isConstraintError,
  ownedQuantities,
  shareCard,
} from '../lib/db'
import { HttpError, nowIso, placeholders, readJson } from '../lib/http'
import { notifyUsers } from '../lib/notify'

interface TradeRow {
  id: string
  from_user: string
  to_user: string
  status: TradeStatus
  message: string
  created_at: string
  resolved_at: string | null
}

interface ItemRow {
  trade_id: string
  side: 'offer' | 'request'
  card_id: string
  quantity: number
}

/** Fusionne les lignes d'une même carte. */
function merge(items: { cardId: string; quantity: number }[]) {
  const map = new Map<string, number>()
  for (const item of items) map.set(item.cardId, (map.get(item.cardId) ?? 0) + item.quantity)
  return map
}

async function assertOwns(
  db: D1Database,
  userId: string,
  wanted: Map<string, number>,
  message: string,
) {
  const owned = await ownedQuantities(db, userId, [...wanted.keys()])
  for (const [cardId, quantity] of wanted) {
    if ((owned.get(cardId) ?? 0) < quantity) throw new HttpError(409, message)
  }
}

/**
 * Charge des échanges complets (joueurs et cartes), vus par `viewerId` : les cartes qu'il ne
 * possède pas restent face cachée, même s'il les demande ou si on les lui propose.
 */
async function loadTrades(db: D1Database, rows: TradeRow[], viewerId: string): Promise<Trade[]> {
  if (!rows.length) return []
  const ids = rows.map((r) => r.id)
  const { results: items } = await db
    .prepare(`SELECT * FROM trade_items WHERE trade_id IN (${placeholders(ids.length)})`)
    .bind(...ids)
    .all<ItemRow>()
  const userIds = [...new Set(rows.flatMap((r) => [r.from_user, r.to_user]))]
  const { results: users } = await db
    .prepare(`SELECT id, display_name FROM users WHERE id IN (${placeholders(userIds.length)})`)
    .bind(...userIds)
    .all<{ id: string; display_name: string }>()
  const names = new Map(users.map((u) => [u.id, u.display_name]))
  const cardIds = items.map((i) => i.card_id)
  const [cards, mine] = await Promise.all([
    cardsByIds(db, cardIds),
    ownedQuantities(db, viewerId, cardIds),
  ])

  return rows.map((row) => {
    const side = (s: ItemRow['side']) =>
      items
        .filter((i) => i.trade_id === row.id && i.side === s && cards.has(i.card_id))
        .map((i) => shareCard(cards.get(i.card_id)!, i.quantity, (mine.get(i.card_id) ?? 0) > 0))
    return {
      id: row.id,
      from: { id: row.from_user, displayName: names.get(row.from_user) ?? 'Joueur supprimé' },
      to: { id: row.to_user, displayName: names.get(row.to_user) ?? 'Joueur supprimé' },
      status: row.status,
      message: row.message,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      offer: side('offer'),
      request: side('request'),
    }
  })
}

async function getTradeRow(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM trades WHERE id = ?').bind(id).first<TradeRow>()
  if (!row) throw new HttpError(404, 'Échange introuvable')
  return row
}

/** Passe un échange en attente à un statut final (refus ou annulation). */
async function close(
  db: D1Database,
  id: string,
  status: TradeStatus,
  column: 'from_user' | 'to_user',
  userId: string,
) {
  const result = await db
    .prepare(
      `UPDATE trades SET status = ?, resolved_at = ? WHERE id = ? AND ${column} = ? AND status = 'pending'
       RETURNING *`,
    )
    .bind(status, nowIso(), id, userId)
    .first<TradeRow>()
  if (!result) {
    const row = await getTradeRow(db, id)
    if (row[column] !== userId) throw new HttpError(403, 'Cet échange ne vous concerne pas')
    throw new HttpError(409, 'Cet échange a déjà été traité')
  }
  return result
}

/** Prévient le proposeur de l'issue de son échange (en tâche de fond). */
function notifyOutcome(
  c: Context<AppEnv>,
  row: TradeRow,
  recipientName: string,
  outcome: TradeOutcome,
) {
  c.executionCtx.waitUntil(
    notifyUsers(c.env, [row.from_user], tradeResolvedNotification(row.id, recipientName, outcome)),
  )
}

export const tradeRoutes = new Hono<AppEnv>()
  .use(requireUser)

  .get('/', async (c) => {
    const userId = c.get('user').id
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM trades WHERE from_user = ?1 OR to_user = ?1
       ORDER BY status = 'pending' DESC, created_at DESC LIMIT 100`,
    )
      .bind(userId)
      .all<TradeRow>()
    return c.json(await loadTrades(c.env.DB, results, userId))
  })

  .post('/', async (c) => {
    const input = await readJson(c, createTradeRequestSchema)
    const db = c.env.DB
    const me = c.get('user')
    if (input.toUserId === me.id) throw new HttpError(400, 'Impossible d’échanger avec soi-même')
    if (!input.offer.length && !input.request.length) throw new HttpError(400, 'L’échange est vide')

    const partner = await db
      .prepare('SELECT id FROM users WHERE id = ? AND disabled = 0')
      .bind(input.toUserId)
      .first()
    if (!partner) throw new HttpError(404, 'Joueur introuvable')

    const offer = merge(input.offer)
    const request = merge(input.request)
    await assertOwns(db, me.id, offer, 'Vous ne possédez pas toutes les cartes proposées')
    await assertOwns(
      db,
      input.toUserId,
      request,
      'Ce joueur ne possède pas toutes les cartes demandées',
    )

    const id = crypto.randomUUID()
    const items = [
      ...[...offer].map(([cardId, quantity]) => ['offer', cardId, quantity] as const),
      ...[...request].map(([cardId, quantity]) => ['request', cardId, quantity] as const),
    ]
    await db.batch([
      db
        .prepare(
          "INSERT INTO trades (id, from_user, to_user, status, message, created_at) VALUES (?, ?, ?, 'pending', ?, ?)",
        )
        .bind(id, me.id, input.toUserId, input.message, nowIso()),
      ...items.map(([side, cardId, quantity]) =>
        db
          .prepare(
            'INSERT INTO trade_items (trade_id, side, card_id, quantity) VALUES (?, ?, ?, ?)',
          )
          .bind(id, side, cardId, quantity),
      ),
    ])
    const [trade] = await loadTrades(db, [await getTradeRow(db, id)], me.id)
    c.executionCtx.waitUntil(
      notifyUsers(
        c.env,
        [input.toUserId],
        tradeRequestNotification(id, me.displayName, input.message),
      ),
    )
    return c.json(trade, 201)
  })

  .post('/:id/accept', async (c) => {
    const db = c.env.DB
    const id = c.req.param('id')
    const me = c.get('user')
    const userId = me.id
    const row = await getTradeRow(db, id)
    if (row.to_user !== userId) throw new HttpError(403, 'Seul le destinataire peut accepter')
    if (row.status !== 'pending') throw new HttpError(409, 'Cet échange a déjà été traité')

    const { results: items } = await db
      .prepare('SELECT * FROM trade_items WHERE trade_id = ?')
      .bind(id)
      .all<ItemRow>()
    const now = nowIso()
    const moves = items.flatMap((item) => {
      const [giver, receiver] =
        item.side === 'offer' ? [row.from_user, row.to_user] : [row.to_user, row.from_user]
      return [
        ...inventoryDelta(db, giver, item.card_id, -item.quantity, now),
        ...inventoryDelta(db, receiver, item.card_id, item.quantity, now),
      ]
    })

    try {
      // Un seul batch = une transaction. Si l'échange n'est plus en attente, le statut « invalid »
      // viole la contrainte CHECK ; si un joueur n'a plus une carte, c'est la quantité qui la viole.
      await db.batch([
        db
          .prepare(
            "UPDATE trades SET status = CASE WHEN status = 'pending' THEN 'accepted' ELSE 'invalid' END, resolved_at = ? WHERE id = ?",
          )
          .bind(now, id),
        ...moves,
      ])
    } catch (err) {
      if (!isConstraintError(err)) throw err
      const current = await getTradeRow(db, id)
      if (current.status !== 'pending') throw new HttpError(409, 'Cet échange a déjà été traité')
      await db
        .prepare(
          "UPDATE trades SET status = 'failed', resolved_at = ? WHERE id = ? AND status = 'pending'",
        )
        .bind(now, id)
        .run()
      notifyOutcome(c, row, me.displayName, 'failed')
      throw new HttpError(
        409,
        'Échange impossible : l’un de vous ne possède plus les cartes prévues',
      )
    }

    notifyOutcome(c, row, me.displayName, 'accepted')
    const [trade] = await loadTrades(db, [await getTradeRow(db, id)], userId)
    return c.json(trade)
  })

  .post('/:id/decline', async (c) => {
    const me = c.get('user')
    const row = await close(c.env.DB, c.req.param('id'), 'declined', 'to_user', me.id)
    notifyOutcome(c, row, me.displayName, 'declined')
    return c.body(null, 204)
  })

  .post('/:id/cancel', async (c) => {
    await close(c.env.DB, c.req.param('id'), 'cancelled', 'from_user', c.get('user').id)
    return c.body(null, 204)
  })
