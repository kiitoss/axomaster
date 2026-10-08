/**
 * Hachage des mots de passe : PBKDF2-SHA256 via WebCrypto (disponible dans les Workers et dans
 * Node ≥ 20, ce qui permet aux scripts de création de comptes de réutiliser ce module).
 * Format stocké : `pbkdf2$<itérations>$<sel base64>$<hash base64>`.
 *
 * Le nombre d'itérations reste modeste à cause de la limite de CPU du palier gratuit des
 * Workers ; il est stocké avec le hash pour pouvoir l'augmenter plus tard.
 */
const ITERATIONS = 50_000

export async function hashPassword(password: string, iterations = ITERATIONS): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, iterations)
  return `pbkdf2$${iterations}$${toBase64(salt)}$${toBase64(hash)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, iter, salt, hash] = stored.split('$')
  if (scheme !== 'pbkdf2' || !iter || !salt || !hash) return false
  const actual = await derive(password, fromBase64(salt), Number(iter))
  return timingSafeEqual(actual, fromBase64(hash))
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )
  return new Uint8Array(bits)
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!
  return diff === 0
}

export function toBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
}
