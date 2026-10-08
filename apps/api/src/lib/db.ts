import type { AdminCard, Card, CardStatus, OwnedCard } from '@axomaster/card-model'
import { placeholders } from './http'

export interface CardRow {
  id: string
  data: string
  status: CardStatus
  category_id: string | null
  rarity: string
  number: number | null
  updated_at: string
  published_at: string | null
}

/** Les cartes sont validées à l'écriture : on les relit sans revalider. */
export function parseCard(row: Pick<CardRow, 'data'>): Card {
  return JSON.parse(row.data) as Card
}

export function toAdminCard(row: CardRow): AdminCard {
  return { card: parseCard(row), status: row.status, publishedAt: row.published_at }
}

/** Crée ou met à jour une carte ; son statut de publication est conservé. */
export function upsertCard(db: D1Database, card: Card) {
  return db
    .prepare(
      `INSERT INTO cards (id, data, category_id, rarity, number, updated_at) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET data = excluded.data, category_id = excluded.category_id,
         rarity = excluded.rarity, number = excluded.number, updated_at = excluded.updated_at`,
    )
    .bind(card.id, JSON.stringify(card), card.categoryId, card.rarity, card.number, card.updatedAt)
}

export async function getAdminCard(db: D1Database, id: string) {
  const row = await db.prepare('SELECT * FROM cards WHERE id = ?').bind(id).first<CardRow>()
  return row ? toAdminCard(row) : null
}

/** Cartes par identifiant (ordre non garanti). */
export async function cardsByIds(db: D1Database, ids: string[]): Promise<Map<string, Card>> {
  const unique = [...new Set(ids)]
  const map = new Map<string, Card>()
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90)
    const { results } = await db
      .prepare(`SELECT data FROM cards WHERE id IN (${placeholders(chunk.length)})`)
      .bind(...chunk)
      .all<Pick<CardRow, 'data'>>()
    for (const row of results) {
      const card = parseCard(row)
      map.set(card.id, card)
    }
  }
  return map
}

/**
 * Instructions qui ajoutent (ou retirent, si `delta` est négatif) des exemplaires à l'inventaire
 * d'un joueur, à exécuter dans un batch. Retirer plus d'exemplaires qu'il n'y en a viole la
 * contrainte CHECK et annule tout le batch : c'est voulu.
 */
export function inventoryDelta(
  db: D1Database,
  userId: string,
  cardId: string,
  delta: number,
  now: string,
): D1PreparedStatement[] {
  if (delta >= 0) {
    return [
      db
        .prepare(
          `INSERT INTO user_cards (user_id, card_id, quantity, first_obtained_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (user_id, card_id) DO UPDATE SET quantity = quantity + excluded.quantity`,
        )
        .bind(userId, cardId, delta, now),
    ]
  }
  // SQLite vérifie les CHECK avant le conflit d'un upsert : on garantit d'abord une ligne
  // (à 0 si le joueur n'a jamais eu la carte) puis on décrémente.
  return [
    db
      .prepare(
        `INSERT INTO user_cards (user_id, card_id, quantity, first_obtained_at) VALUES (?, ?, 0, ?)
         ON CONFLICT (user_id, card_id) DO NOTHING`,
      )
      .bind(userId, cardId, now),
    db
      .prepare('UPDATE user_cards SET quantity = quantity + ? WHERE user_id = ? AND card_id = ?')
      .bind(delta, userId, cardId),
  ]
}

/** Cartes possédées (au moins un exemplaire). */
export async function ownedCards(db: D1Database, userId: string): Promise<OwnedCard[]> {
  const { results } = await db
    .prepare(
      `SELECT c.data, uc.quantity FROM user_cards uc JOIN cards c ON c.id = uc.card_id
       WHERE uc.user_id = ? AND uc.quantity > 0
       ORDER BY c.category_id, c.number, c.id`,
    )
    .bind(userId)
    .all<{ data: string; quantity: number }>()
  return results.map((r) => ({ card: parseCard(r), quantity: r.quantity }))
}

/** Quantités possédées par carte. */
export async function ownedQuantities(db: D1Database, userId: string, cardIds: string[]) {
  const map = new Map<string, number>()
  const unique = [...new Set(cardIds)]
  if (!unique.length) return map
  const { results } = await db
    .prepare(
      `SELECT card_id, quantity FROM user_cards WHERE user_id = ? AND card_id IN (${placeholders(unique.length)})`,
    )
    .bind(userId, ...unique)
    .all<{ card_id: string; quantity: number }>()
  for (const r of results) map.set(r.card_id, r.quantity)
  return map
}

/** Une contrainte (CHECK, clé étrangère…) a fait échouer la requête. */
export function isConstraintError(err: unknown) {
  return err instanceof Error && /constraint/i.test(err.message)
}
