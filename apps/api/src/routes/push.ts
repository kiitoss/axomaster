import { Hono } from 'hono'
import {
  pushSubscriptionSchema,
  pushUnsubscribeRequestSchema,
  type PushConfig,
} from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { requireUser } from '../lib/auth'
import { nowIso, readJson } from '../lib/http'
import { vapidKeys } from '../lib/notify'

export const pushRoutes = new Hono<AppEnv>()
  /** Public : le front sait ainsi s'il doit proposer les notifications. */
  .get('/config', (c) => {
    const body: PushConfig = { publicKey: vapidKeys(c.env)?.publicKey ?? null }
    return c.json(body)
  })

  /** Enregistre l'appareil ; un endpoint déjà connu est rattaché au compte courant. */
  .post('/subscriptions', requireUser, async (c) => {
    const input = await readJson(c, pushSubscriptionSchema)
    await c.env.DB.prepare(
      `INSERT INTO push_subscriptions (endpoint, user_id, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (endpoint) DO UPDATE SET
         user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    )
      .bind(input.endpoint, c.get('user').id, input.keys.p256dh, input.keys.auth, nowIso())
      .run()
    return c.body(null, 204)
  })

  .delete('/subscriptions', requireUser, async (c) => {
    const { endpoint } = await readJson(c, pushUnsubscribeRequestSchema)
    await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?')
      .bind(endpoint, c.get('user').id)
      .run()
    return c.body(null, 204)
  })
