import { Hono } from 'hono'
import { loginRequestSchema } from '@axomaster/card-model'
import type { AppEnv } from '../env'
import {
  assertLoginAllowed,
  clearLoginFailures,
  createSession,
  currentUser,
  destroySession,
  recordLoginFailure,
  toSessionUser,
  type UserRow,
} from '../lib/auth'
import { HttpError, readJson } from '../lib/http'
import { verifyPassword } from '../lib/password'

// Hash factice : la vérification prend le même temps que l'identifiant existe ou non.
const DUMMY_HASH =
  'pbkdf2$50000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

export const authRoutes = new Hono<AppEnv>()
  .post('/login', async (c) => {
    const { username, password } = await readJson(c, loginRequestSchema)
    await assertLoginAllowed(c.env.DB, username)

    const row = await c.env.DB.prepare('SELECT * FROM users WHERE username = ? AND disabled = 0')
      .bind(username)
      .first<UserRow>()
    const valid = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH)
    if (!row?.password_hash || !valid) {
      await recordLoginFailure(c.env.DB, username)
      throw new HttpError(401, 'Identifiant ou mot de passe incorrect')
    }

    await clearLoginFailures(c.env.DB, username)
    await createSession(c, row.id)
    return c.json(toSessionUser(row))
  })
  .post('/logout', async (c) => {
    await destroySession(c)
    return c.body(null, 204)
  })
  .get('/me', async (c) => {
    const user = await currentUser(c)
    if (!user) throw new HttpError(401, 'Connexion requise')
    return c.json(user)
  })
