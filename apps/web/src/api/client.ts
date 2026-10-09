/**
 * Client de l'API. Les URL sont relatives (`api/...`) : le front et l'API sont servis par le
 * même Worker, éventuellement sous un sous-chemin. En local, Vite relaie `/api` vers wrangler.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** Appelé quand la session a expiré (réponse 401 hors connexion). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

export function apiUrl(path: string) {
  return `api/${path.replace(/^\//, '')}`
}

export async function api<T = void>(method: string, path: string, body?: unknown): Promise<T> {
  const isBlob = body instanceof Blob
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method,
      credentials: 'same-origin',
      headers:
        body === undefined
          ? undefined
          : { 'Content-Type': isBlob ? body.type : 'application/json' },
      body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'Serveur injoignable. Vérifiez votre connexion.')
  }

  if (!res.ok) {
    let message = `Erreur ${res.status}`
    try {
      const data = (await res.json()) as { error?: string }
      if (data.error) message = data.error
    } catch {
      // Corps non JSON : on garde le message générique.
    }
    if (res.status === 401 && !path.startsWith('auth/')) onUnauthorized?.()
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const get = <T>(path: string) => api<T>('GET', path)
export const post = <T = void>(path: string, body?: unknown) => api<T>('POST', path, body)
export const put = <T = void>(path: string, body?: unknown) => api<T>('PUT', path, body)
export const patch = <T = void>(path: string, body?: unknown) => api<T>('PATCH', path, body)
export const del = <T = void>(path: string, body?: unknown) => api<T>('DELETE', path, body)

/** Message lisible pour une erreur quelconque. */
export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : 'Une erreur est survenue'
}
