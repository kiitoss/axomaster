import type { Context } from 'hono'
import type { z } from 'zod'

/** Erreur métier renvoyée telle quelle au client (message en français). */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 429,
    message: string,
  ) {
    super(message)
  }
}

/** Lit et valide le corps JSON de la requête. */
export async function readJson<T extends z.ZodType>(c: Context, schema: T): Promise<z.output<T>> {
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    throw new HttpError(400, 'Corps de requête JSON invalide')
  }
  const result = schema.safeParse(body)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    throw new HttpError(400, `Requête invalide${where} : ${issue?.message ?? 'erreur inconnue'}`)
  }
  return result.data
}

export function nowIso() {
  return new Date().toISOString()
}

/** `?, ?, ?` pour une clause `IN`. */
export function placeholders(count: number) {
  return Array.from({ length: count }, () => '?').join(', ')
}
