import { env, SELF } from 'cloudflare:test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createBlankCard,
  type Boosters,
  type Catalogue,
  type Leaderboard,
  type OwnershipEntry,
  type OpenBoosterResponse,
  type PlayerCard,
  type Rarity,
  type NotificationPayload,
  type SharedCard,
  type Trade,
} from '@axomaster/card-model'
import { notifyBoosterRefills } from '../src/jobs/boosterRefills'
import { hashPassword } from '../src/lib/password'
import { fakeDevice, type FakeDevice } from './push-helpers'

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
    expect((await api('POST', '/boosters/open')).status).toBe(409)

    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    const opened = await api<OpenBoosterResponse>('POST', '/boosters/open')
    expect(opened.status).toBe(200)
    expect(opened.data.cards).toHaveLength(5)
    expect(opened.data.stock.total).toBe(0)

    const { data } = await api<Catalogue>('GET', '/catalogue')
    const total = data.entries.reduce((sum, e) => sum + (e.owned ? e.quantity : 0), 0)
    expect(total).toBe(5)
  })

  it('refuse un booster vide', async () => {
    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    expect((await client(alice)('POST', '/boosters/open')).status).toBe(404)
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

  it('ne révèle pas les cartes d’un autre joueur que l’on ne possède pas', async () => {
    const a = await addCard(admin)
    const b = await addCard(admin, 'rare')
    await give(alice.id, a.id, 1)
    await give(bob.id, a.id, 2)
    await give(bob.id, b.id, 1)

    const { data: cards } = await client(alice)<SharedCard[]>('GET', `/players/${bob.id}/cards`)
    const byId = new Map(cards.map((item) => [item.id, item]))
    expect(byId.get(a.id)).toMatchObject({ quantity: 2, card: { name: a.name } })
    expect(byId.get(b.id)).toMatchObject({ quantity: 1, number: b.number })
    expect(byId.get(b.id)).not.toHaveProperty('card')
    expect(JSON.stringify(cards)).not.toContain(b.name)

    // Demander une carte inconnue ne la révèle pas non plus dans l'échange.
    const created = await client(alice)<Trade>('POST', '/trades', {
      toUserId: bob.id,
      offer: [{ cardId: a.id, quantity: 1 }],
      request: [{ cardId: b.id, quantity: 1 }],
    })
    expect(created.data.request[0]).not.toHaveProperty('card')
    expect(created.data.offer[0]?.card?.name).toBe(a.name)
    const { data: trades } = await client(alice)<Trade[]>('GET', '/trades')
    expect(JSON.stringify(trades)).not.toContain(b.name)
    // Bob, lui, possède les deux cartes.
    const { data: bobTrades } = await client(bob)<Trade[]>('GET', '/trades')
    expect(bobTrades[0]?.request[0]?.card?.name).toBe(b.name)
  })
})

describe('classement', () => {
  it('classe les joueurs actifs par cartes publiées débloquées, sans contenu de carte', async () => {
    const a = await addCard(admin)
    const b = await addCard(admin)
    const draft = await addCard(admin, 'common', false)
    const carole = await createUser('carole')
    await give(alice.id, a.id, 1)
    await give(bob.id, a.id, 3)
    await give(bob.id, b.id, 1)
    await give(bob.id, draft.id, 1)
    await give(carole, a.id, 1)
    await give(carole, b.id, 1)
    await env.DB.prepare('UPDATE users SET disabled = 1 WHERE id = ?').bind(carole).run()

    const res = await client(alice)<Leaderboard>('GET', '/leaderboard')
    expect(res.status).toBe(200)
    expect(res.data.cards.map((card) => card.id).sort()).toEqual([a.id, b.id].sort())
    expect(res.data.cards[0]).not.toHaveProperty('data')
    expect(res.data.players.map((p) => [p.displayName, p.owned.length])).toEqual([
      ['bob', 2],
      ['alice', 1],
      ['admin', 0],
    ])
    expect(res.data.players[0]!.owned.sort()).toEqual([a.id, b.id].sort())
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

  it('montre à l’admin les cartes possédées par un joueur', async () => {
    await addCard(admin)
    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    const opened = await client(alice)<OpenBoosterResponse>('POST', '/boosters/open')

    const res = await client(admin)<PlayerCard[]>('GET', `/admin/users/${alice.id}/cards`)
    expect(res.status).toBe(200)
    expect(res.data).toHaveLength(1)
    expect(res.data[0]!.cardId).toBe(opened.data.cards[0]!.id)
    expect(res.data[0]!.quantity).toBe(5)

    expect((await client(alice)('GET', `/admin/users/${alice.id}/cards`)).status).toBe(403)
    expect((await client(admin)('GET', '/admin/users/inconnu/cards')).status).toBe(404)
  })

  it('donne à l’admin toutes les possessions', async () => {
    const card = await addCard(admin)
    await give(alice.id, card.id, 2)
    await give(bob.id, card.id, 0)

    const res = await client(admin)<OwnershipEntry[]>('GET', '/admin/ownership')
    expect(res.status).toBe(200)
    expect(res.data).toEqual([{ userId: alice.id, cardId: card.id, quantity: 2 }])
    expect((await client(alice)('GET', '/admin/ownership')).status).toBe(403)
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

describe('notifications push', () => {
  /** Messages reçus par endpoint ; le statut renvoyé par le faux service de push est réglable. */
  let inbox: Map<string, NotificationPayload[]>
  let devices: Map<string, FakeDevice>
  let pushStatus: number

  beforeEach(() => {
    inbox = new Map()
    devices = new Map()
    pushStatus = 201
    const realFetch = globalThis.fetch
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      const device = devices.get(url)
      if (!device) return realFetch(input, init)
      expect(new Headers(init?.headers).get('Authorization')).toMatch(/^vapid t=.+, k=.+$/)
      const payload = await device.decrypt(await new Response(init?.body).arrayBuffer())
      inbox.set(url, [...(inbox.get(url) ?? []), payload])
      return new Response(null, { status: pushStatus })
    })
  })

  afterEach(() => vi.restoreAllMocks())

  async function subscribe(session: Session, name: string) {
    const device = await fakeDevice(`https://push.test/${name}`)
    devices.set(device.subscription.endpoint, device)
    const res = await client(session)('POST', '/push/subscriptions', device.subscription)
    expect(res.status).toBe(204)
    return device.subscription.endpoint
  }

  const received = (endpoint: string) => inbox.get(endpoint) ?? []
  const waitFor = (check: () => void | Promise<void>) =>
    vi.waitFor(check, { timeout: 2000, interval: 20 })

  async function subscriptionOwner(endpoint: string) {
    const row = await env.DB.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint = ?')
      .bind(endpoint)
      .first<{ user_id: string }>()
    return row?.user_id ?? null
  }

  it('expose la clé publique VAPID', async () => {
    const res = await client()<{ publicKey: string | null }>('GET', '/push/config')
    expect(res.data.publicKey).toBe(env.VAPID_PUBLIC_KEY)
  })

  it('rattache un appareil au dernier compte connecté', async () => {
    const endpoint = await subscribe(alice, 'tel')
    expect(await subscriptionOwner(endpoint)).toBe(alice.id)

    const device = devices.get(endpoint)!
    await client(bob)('POST', '/push/subscriptions', device.subscription)
    expect(await subscriptionOwner(endpoint)).toBe(bob.id)

    // Alice ne peut plus le supprimer, Bob si.
    await client(alice)('DELETE', '/push/subscriptions', { endpoint })
    expect(await subscriptionOwner(endpoint)).toBe(bob.id)
    await client(bob)('DELETE', '/push/subscriptions', { endpoint })
    expect(await subscriptionOwner(endpoint)).toBeNull()
  })

  it('offre des boosters à un joueur avec un message', async () => {
    const aliceTel = await subscribe(alice, 'alice')
    const bobTel = await subscribe(bob, 'bob')
    const api = client(admin)

    const res = await api('POST', `/admin/users/${alice.id}/boosters/gift`, {
      count: 2,
      message: 'Merci pour la démo !',
    })
    expect(res.status).toBe(204)
    const { data } = await client(alice)<Boosters>('GET', '/boosters')
    expect(data.stock.bonus).toBe(2)

    await waitFor(() =>
      expect(received(aliceTel)).toEqual([
        {
          title: '2 boosters offerts !',
          body: 'Merci pour la démo !',
          url: './#/boosters',
          tag: 'gift',
        },
      ]),
    )
    expect(received(bobTel)).toEqual([])

    const gift = (session: Session, userId: string, body: unknown) =>
      client(session)('POST', `/admin/users/${userId}/boosters/gift`, body)
    expect((await gift(admin, 'inconnu', { count: 1 })).status).toBe(404)
    expect((await gift(admin, alice.id, { count: 1, message: 'x'.repeat(141) })).status).toBe(400)
    expect((await gift(alice, alice.id, { count: 1 })).status).toBe(403)
  })

  it('prévient tous les joueurs d’un cadeau collectif', async () => {
    const aliceTel = await subscribe(alice, 'alice')
    const bobTel = await subscribe(bob, 'bob')
    await client(admin)('POST', '/admin/boosters/gift-all', { count: 1 })
    await waitFor(() => {
      expect(received(aliceTel).map((n) => n.body)).toEqual([
        'Un cadeau vous attend dans l’onglet Boosters.',
      ])
      expect(received(bobTel)).toHaveLength(1)
    })
  })

  it('prévient des propositions d’échange et de leur issue', async () => {
    const aliceTel = await subscribe(alice, 'alice')
    const bobTel = await subscribe(bob, 'bob')
    const card = await addCard(admin)
    await give(alice.id, card.id, 3)
    const propose = () =>
      client(alice)<Trade>('POST', '/trades', {
        toUserId: bob.id,
        offer: [{ cardId: card.id, quantity: 1 }],
        request: [],
        message: 'Pour toi',
      })

    const first = await propose()
    await waitFor(() =>
      expect(received(bobTel)).toEqual([
        {
          title: 'Nouvelle proposition d’échange',
          body: 'alice : « Pour toi »',
          url: './#/echanges',
          tag: `trade-${first.data.id}`,
        },
      ]),
    )

    await client(bob)('POST', `/trades/${first.data.id}/decline`)
    await waitFor(() => expect(received(aliceTel).map((n) => n.title)).toEqual(['Échange refusé']))

    const second = await propose()
    await client(bob)('POST', `/trades/${second.data.id}/accept`)
    await waitFor(() =>
      expect(received(aliceTel).map((n) => n.title)).toEqual(['Échange refusé', 'Échange accepté']),
    )

    // Une annulation ne dérange pas le destinataire.
    const third = await propose()
    await client(alice)('POST', `/trades/${third.data.id}/cancel`)
    await waitFor(() => expect(received(bobTel)).toHaveLength(3))
    expect(received(bobTel).every((n) => n.title === 'Nouvelle proposition d’échange')).toBe(true)
  })

  it('oublie un abonnement expiré', async () => {
    const endpoint = await subscribe(alice, 'ancien')
    pushStatus = 410
    await client(admin)('POST', `/admin/users/${alice.id}/boosters/gift`, { count: 1 })
    await waitFor(async () => expect(await subscriptionOwner(endpoint)).toBeNull())
  })

  describe('recharges de boosters', () => {
    const HOUR = 3600_000
    const now = new Date('2026-10-09T12:00:00.000Z')
    const at = (offset: number) => new Date(now.getTime() + offset).toISOString()

    beforeEach(async () => {
      // Recharge toutes les heures, réserve de 3.
      await client(admin)('PUT', '/admin/settings', { intervalSeconds: 3600, maxStock: 3, size: 5 })
    })

    async function setQuota(userId: string, anchor: string, notifyAt: string | null) {
      await env.DB.prepare(
        'UPDATE users SET booster_anchor = ?, booster_notify_at = ? WHERE id = ?',
      )
        .bind(anchor, notifyAt, userId)
        .run()
    }

    async function notifyAt(userId: string) {
      const row = await env.DB.prepare('SELECT booster_notify_at FROM users WHERE id = ?')
        .bind(userId)
        .first<{ booster_notify_at: string | null }>()
      return row?.booster_notify_at ?? null
    }

    it('initialise la prochaine recharge sans notifier', async () => {
      const endpoint = await subscribe(alice, 'alice')
      await setQuota(alice.id, at(-0.5 * HOUR), null)
      expect(await notifyBoosterRefills(env, now)).toBe(0)
      expect(await notifyAt(alice.id)).toBe(at(0.5 * HOUR))
      expect(received(endpoint)).toEqual([])
    })

    it('notifie chaque recharge puis vise la suivante', async () => {
      const endpoint = await subscribe(alice, 'alice')
      // Une recharge échue il y a 12 minutes : 1 booster disponible.
      await setQuota(alice.id, at(-1.2 * HOUR), at(-0.2 * HOUR))
      expect(await notifyBoosterRefills(env, now)).toBe(1)
      expect(received(endpoint)).toEqual([
        {
          title: 'Un booster vous attend',
          body: 'Vous avez 1 booster à ouvrir.',
          url: './#/boosters',
          tag: 'booster',
        },
      ])
      expect(await notifyAt(alice.id)).toBe(at(0.8 * HOUR))

      // Rien de nouveau avant l'échéance suivante.
      expect(await notifyBoosterRefills(env, now)).toBe(0)
      expect(await notifyBoosterRefills(env, new Date(now.getTime() + HOUR))).toBe(1)
      expect(received(endpoint).at(-1)?.body).toBe('Vous avez 2 boosters à ouvrir.')
    })

    it('s’arrête quand la réserve est pleine', async () => {
      await subscribe(alice, 'alice')
      await setQuota(alice.id, at(-10 * HOUR), at(-HOUR))
      expect(await notifyBoosterRefills(env, now)).toBe(1)
      expect(await notifyAt(alice.id)).toBeNull()
    })

    it('ignore les joueurs sans appareil abonné', async () => {
      await setQuota(bob.id, at(-1.2 * HOUR), at(-0.2 * HOUR))
      expect(await notifyBoosterRefills(env, now)).toBe(0)
      expect(await notifyAt(bob.id)).toBe(at(-0.2 * HOUR))
    })

    it('reprogramme la recharge à l’ouverture d’un booster', async () => {
      await addCard(admin)
      await setQuota(alice.id, at(-30 * HOUR), null)
      const opened = await client(alice)<OpenBoosterResponse>('POST', '/boosters/open')
      expect(opened.status).toBe(200)
      expect(await notifyAt(alice.id)).toBe(opened.data.stock.nextAt)
    })
  })
})
