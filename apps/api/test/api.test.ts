import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createBlankCard,
  type Boosters,
  type Catalogue,
  type OpenBoosterResponse,
  type Rarity,
  type Trade,
} from '@axomaster/card-model'
import { hashPassword } from '../src/lib/password'

const BASE = 'https://axomaster.test/api'

interface Session {
  id: string
  cookie: string
}

/** Petit client HTTP authentifié. */
function client(session?: Session) {
  return async <T = unknown>(method: string, path: string, body?: unknown) => {
    const res = await SELF.fetch(`${BASE}${path}`, {
      method,
      headers: {
        ...(session ? { Cookie: session.cookie } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    return { status: res.status, data: (text ? JSON.parse(text) : null) as T }
  }
}

async function createUser(username: string, role: 'admin' | 'player' = 'player', bonus = 0) {
  const id = crypto.randomUUID()
  await env.DB.prepare(
    `INSERT INTO users (id, username, display_name, role, password_hash, booster_anchor, bonus_boosters, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      username,
      username,
      role,
      await hashPassword(`${username}-secret`, 1000),
      new Date().toISOString(),
      bonus,
      new Date().toISOString(),
    )
    .run()
  return id
}

async function login(username: string): Promise<Session> {
  const res = await SELF.fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: `${username}-secret` }),
  })
  expect(res.status).toBe(200)
  const user = (await res.json()) as { id: string }
  const cookie = res.headers.get('Set-Cookie')!.split(';')[0]!
  return { id: user.id, cookie }
}

async function addCard(admin: Session, rarity: Rarity = 'common', publish = true) {
  const card = { ...createBlankCard('admin', 'collaborateurs'), rarity, name: `Carte ${rarity}` }
  const api = client(admin)
  expect((await api('PUT', `/admin/cards/${card.id}`, card)).status).toBe(200)
  if (publish) await api('POST', '/admin/cards/status', { ids: [card.id], status: 'published' })
  return card
}

async function give(userId: string, cardId: string, quantity: number) {
  await env.DB.prepare(
    'INSERT INTO user_cards (user_id, card_id, quantity, first_obtained_at) VALUES (?, ?, ?, ?)',
  )
    .bind(userId, cardId, quantity, new Date().toISOString())
    .run()
}

async function quantity(userId: string, cardId: string) {
  const row = await env.DB.prepare(
    'SELECT quantity FROM user_cards WHERE user_id = ? AND card_id = ?',
  )
    .bind(userId, cardId)
    .first<{ quantity: number }>()
  return row?.quantity ?? 0
}

let admin: Session
let alice: Session
let bob: Session

beforeEach(async () => {
  await createUser('admin', 'admin')
  await createUser('alice')
  await createUser('bob')
  admin = await login('admin')
  alice = await login('alice')
  bob = await login('bob')
})

describe('authentification', () => {
  it('refuse un mauvais mot de passe', async () => {
    const res = await client()('POST', '/auth/login', { username: 'alice', password: 'nope' })
    expect(res.status).toBe(401)
  })

  it('renvoie l’utilisateur connecté', async () => {
    const res = await client(alice)<{ username: string; role: string }>('GET', '/auth/me')
    expect(res.data).toMatchObject({ username: 'alice', role: 'player' })
  })

  it('réserve les routes admin aux administrateurs', async () => {
    expect((await client()('GET', '/admin/cards')).status).toBe(401)
    expect((await client(alice)('GET', '/admin/cards')).status).toBe(403)
    expect((await client(admin)('GET', '/admin/cards')).status).toBe(200)
  })

  it('ferme la session à la déconnexion', async () => {
    await client(alice)('POST', '/auth/logout')
    expect((await client(alice)('GET', '/auth/me')).status).toBe(401)
  })
})

describe('catalogue', () => {
  it('montre les cartes publiées, face cachée tant qu’elles ne sont pas possédées', async () => {
    const owned = await addCard(admin)
    const hidden = await addCard(admin, 'rare')
    const draft = await addCard(admin, 'epic', false)
    await give(alice.id, owned.id, 2)

    const { data } = await client(alice)<Catalogue>('GET', '/catalogue')
    expect(data.entries).toHaveLength(2)
    expect(data.entries.find((e) => e.owned)).toMatchObject({ quantity: 2, card: { id: owned.id } })
    const back = data.entries.find((e) => !e.owned)!
    expect(back).toEqual({
      owned: false,
      id: hidden.id,
      number: null,
      categoryId: 'collaborateurs',
    })
    expect(JSON.stringify(data)).not.toContain(draft.id)
  })
})

describe('boosters', () => {
  it('ouvre un booster et crédite l’inventaire', async () => {
    await addCard(admin)
    await addCard(admin, 'rare')
    const api = client(alice)

    const before = await api<Boosters>('GET', '/boosters')
    expect(before.data.stock.total).toBe(0)
    expect((await api('POST', '/boosters/open', { pool: 'all' })).status).toBe(409)

    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    const opened = await api<OpenBoosterResponse>('POST', '/boosters/open', { pool: 'all' })
    expect(opened.status).toBe(200)
    expect(opened.data.cards).toHaveLength(5)
    expect(opened.data.stock.total).toBe(0)

    const { data } = await api<Catalogue>('GET', '/catalogue')
    const total = data.entries.reduce((sum, e) => sum + (e.owned ? e.quantity : 0), 0)
    expect(total).toBe(5)
  })

  it('refuse un booster vide', async () => {
    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    expect((await client(alice)('POST', '/boosters/open', { pool: 'all' })).status).toBe(404)
  })
})

describe('échanges', () => {
  it('transfère les cartes à l’acceptation', async () => {
    const a = await addCard(admin)
    const b = await addCard(admin, 'rare')
    await give(alice.id, a.id, 2)
    await give(bob.id, b.id, 1)

    const created = await client(alice)<Trade>('POST', '/trades', {
      toUserId: bob.id,
      offer: [{ cardId: a.id, quantity: 1 }],
      request: [{ cardId: b.id, quantity: 1 }],
    })
    expect(created.status).toBe(201)
    expect(created.data.status).toBe('pending')

    expect((await client(alice)('POST', `/trades/${created.data.id}/accept`)).status).toBe(403)
    const accepted = await client(bob)<Trade>('POST', `/trades/${created.data.id}/accept`)
    expect(accepted.data.status).toBe('accepted')

    expect(await quantity(alice.id, a.id)).toBe(1)
    expect(await quantity(alice.id, b.id)).toBe(1)
    expect(await quantity(bob.id, a.id)).toBe(1)
    expect(await quantity(bob.id, b.id)).toBe(0)

    expect((await client(bob)('POST', `/trades/${created.data.id}/accept`)).status).toBe(409)
  })

  it('refuse de proposer des cartes non possédées', async () => {
    const a = await addCard(admin)
    const res = await client(alice)('POST', '/trades', {
      toUserId: bob.id,
      offer: [{ cardId: a.id, quantity: 1 }],
      request: [],
    })
    expect(res.status).toBe(409)
  })

  it('échoue sans rien modifier si une carte n’est plus disponible', async () => {
    const a = await addCard(admin)
    const b = await addCard(admin, 'rare')
    await give(alice.id, a.id, 1)
    await give(bob.id, b.id, 1)

    const { data: trade } = await client(alice)<Trade>('POST', '/trades', {
      toUserId: bob.id,
      offer: [{ cardId: a.id, quantity: 1 }],
      request: [{ cardId: b.id, quantity: 1 }],
    })
    // Alice a perdu sa carte entre-temps (autre échange, par exemple).
    await env.DB.prepare('UPDATE user_cards SET quantity = 0 WHERE user_id = ? AND card_id = ?')
      .bind(alice.id, a.id)
      .run()

    expect((await client(bob)('POST', `/trades/${trade.id}/accept`)).status).toBe(409)
    expect(await quantity(bob.id, b.id)).toBe(1)
    expect(await quantity(bob.id, a.id)).toBe(0)
    expect(await quantity(alice.id, b.id)).toBe(0)

    const { data: trades } = await client(bob)<Trade[]>('GET', '/trades')
    expect(trades[0]?.status).toBe('failed')
  })

  it('permet d’annuler ou de refuser', async () => {
    const a = await addCard(admin)
    await give(alice.id, a.id, 1)
    const propose = () =>
      client(alice)<Trade>('POST', '/trades', {
        toUserId: bob.id,
        offer: [{ cardId: a.id, quantity: 1 }],
        request: [],
      })

    const first = (await propose()).data
    expect((await client(bob)('POST', `/trades/${first.id}/cancel`)).status).toBe(403)
    expect((await client(alice)('POST', `/trades/${first.id}/cancel`)).status).toBe(204)

    const second = (await propose()).data
    expect((await client(bob)('POST', `/trades/${second.id}/decline`)).status).toBe(204)
    expect(await quantity(alice.id, a.id)).toBe(1)
  })
})

describe('administration', () => {
  it('crée un joueur qui peut se connecter et reçoit un booster', async () => {
    const res = await client(admin)('POST', '/admin/users', {
      username: 'carole',
      displayName: 'Carole',
      password: 'carole-secret',
      role: 'player',
    })
    expect(res.status).toBe(201)
    const carole = await login('carole')
    const { data } = await client(carole)<Boosters>('GET', '/boosters')
    expect(data.stock.periodic).toBe(1)
  })

  it('stocke et sert les images', async () => {
    const upload = await SELF.fetch(`${BASE}/admin/images`, {
      method: 'POST',
      headers: { Cookie: admin.cookie, 'Content-Type': 'image/webp' },
      body: new Uint8Array([1, 2, 3, 4]),
    })
    expect(upload.status).toBe(201)
    const { id } = (await upload.json()) as { id: string }

    const res = await SELF.fetch(`${BASE}/images/${id}`, { headers: { Cookie: alice.cookie } })
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect([...new Uint8Array(await res.arrayBuffer())]).toEqual([1, 2, 3, 4])
  })
})
