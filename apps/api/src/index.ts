import { Hono } from 'hono'
import type { AppEnv, Env } from './env'
import { notifyBoosterRefills } from './jobs/boosterRefills'
import { HttpError } from './lib/http'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { playerRoutes } from './routes/player'
import { pushRoutes } from './routes/push'
import { tradeRoutes } from './routes/trades'

/**
 * Point d'entrée du Worker. Les fichiers statiques (build Vite) sont servis par Cloudflare
 * avant d'arriver ici ; seules les requêtes `/api/*` atteignent Hono (cf. wrangler.jsonc).
 */
const app = new Hono<AppEnv>().basePath('/api')

app.route('/auth', authRoutes)
app.route('/admin', adminRoutes)
app.route('/trades', tradeRoutes)
app.route('/push', pushRoutes)
app.route('/', playerRoutes)

app.notFound((c) => c.json({ error: 'Route inconnue' }, 404))

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status)
  console.error(err)
  return c.json({ error: 'Erreur interne du serveur' }, 500)
})

export default {
  fetch: app.fetch,
  /** Cron (wrangler.jsonc) : notifications de recharge des boosters. */
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(notifyBoosterRefills(env))
  },
} satisfies ExportedHandler<Env>
