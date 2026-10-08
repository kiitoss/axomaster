import type { Context, MiddlewareHandler } from 'hono'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import type { Role, SessionUser } from '@axomaster/card-model'
import type { AppEnv } from '../env'
import { HttpError } from './http'
import { toBase64 } from './password'

export const SESSION_COOKIE = 'axo_session'
const SESSION_DAYS = 30
/** La session est prolongée quand il lui reste moins que ce délai. */
const RENEW_DAYS = 15
const DAY = 86_400_000

export interface UserRow {
  id: string
  username: string
  display_name: string
  role: Role
  password_hash: string | null
  bonus_boosters: number
  booster_anchor: string
  disabled: number
  created_at: string
}

export function toSessionUser(row: UserRow): SessionUser {
  return { id: row.id, username: row.username, displayName: row.display_name, role: row.role }
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toBase64(new Uint8Array(digest))
}

function cookieOptions(c: Context, expires: Date) {
  return {
    path: '/',
    httpOnly: true,
    // En local, l'API est servie en http (proxy Vite).
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Lax' as const,
    expires,
  }
}

/** Ouvre une session : seul le hash du jeton est stocké en base. */
export async function createSession(c: Context<AppEnv>, userId: string) {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)))
  const expires = new Date(Date.now() + SESSION_DAYS * DAY)
  await c.env.DB.batch([
    // Ménage opportuniste des sessions expirées.
    c.env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(new Date().toISOString()),
    c.env.DB.prepare(
      'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    ).bind(await sha256(token), userId, expires.toISOString()),
  ])
  setCookie(c, SESSION_COOKIE, token, cookieOptions(c, expires))
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE)
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?')
      .bind(await sha256(token))
      .run()
  }
  deleteCookie(c, SESSION_COOKIE, { path: '/' })
}

/** Utilisateur de la session courante, ou `null`. Prolonge la session si besoin. */
export async function currentUser(c: Context<AppEnv>): Promise<SessionUser | null> {
  const token = getCookie(c, SESSION_COOKIE)
  if (!token) return null
  const tokenHash = await sha256(token)
  const now = new Date()
  const row = await c.env.DB.prepare(
    `SELECT u.*, s.expires_at AS session_expires_at FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
  )
    .bind(tokenHash, now.toISOString())
    .first<UserRow & { session_expires_at: string }>()
  if (!row) return null

  if (new Date(row.session_expires_at).getTime() - now.getTime() < RENEW_DAYS * DAY) {
    const expires = new Date(now.getTime() + SESSION_DAYS * DAY)
    await c.env.DB.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?')
      .bind(expires.toISOString(), tokenHash)
      .run()
    setCookie(c, SESSION_COOKIE, token, cookieOptions(c, expires))
  }
  return toSessionUser(row)
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentUser(c)
  if (!user) throw new HttpError(401, 'Connexion requise')
  c.set('user', user)
  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await currentUser(c)
  if (!user) throw new HttpError(401, 'Connexion requise')
  if (user.role !== 'admin') throw new HttpError(403, 'Réservé aux administrateurs')
  c.set('user', user)
  await next()
}

// ---------- Limitation des tentatives de connexion ----------

const MAX_FAILURES = 5
const WINDOW_MS = 15 * 60_000

export async function assertLoginAllowed(db: D1Database, username: string) {
  const row = await db
    .prepare('SELECT failures, window_start FROM login_attempts WHERE username = ?')
    .bind(username)
    .first<{ failures: number; window_start: string }>()
  if (
    row &&
    row.failures >= MAX_FAILURES &&
    Date.now() - new Date(row.window_start).getTime() < WINDOW_MS
  ) {
    throw new HttpError(429, 'Trop de tentatives. Réessayez dans quelques minutes.')
  }
}

export async function recordLoginFailure(db: D1Database, username: string) {
  const now = new Date()
  const windowStart = new Date(now.getTime() - WINDOW_MS).toISOString()
  await db
    .prepare(
      `INSERT INTO login_attempts (username, failures, window_start) VALUES (?, 1, ?)
       ON CONFLICT (username) DO UPDATE SET
         failures = CASE WHEN window_start < ? THEN 1 ELSE failures + 1 END,
         window_start = CASE WHEN window_start < ? THEN excluded.window_start ELSE window_start END`,
    )
    .bind(username, now.toISOString(), windowStart, windowStart)
    .run()
}

export async function clearLoginFailures(db: D1Database, username: string) {
  await db.prepare('DELETE FROM login_attempts WHERE username = ?').bind(username).run()
}
