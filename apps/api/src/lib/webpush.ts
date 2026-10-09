/**
 * Web Push sans dépendance, en WebCrypto (Workers et Node ≥ 20) :
 * - authentification VAPID (RFC 8292) : jeton JWT signé en ES256 ;
 * - chiffrement du contenu `aes128gcm` (RFC 8291 et RFC 8188), un seul enregistrement.
 *
 * Les clés VAPID sont au format habituel : clé publique = point P-256 non compressé (65 octets),
 * clé privée = scalaire `d` (32 octets), toutes deux en base64url.
 */

export interface VapidKeys {
  publicKey: string
  privateKey: string
  /** `mailto:` ou URL de contact, transmise aux services de push. */
  subject: string
}

export interface PushTarget {
  endpoint: string
  p256dh: string
  auth: string
}

/** Clé éphémère et sel imposés : uniquement pour les tests (vecteurs de la RFC 8291). */
export interface EncryptionOverrides {
  salt: Uint8Array
  serverPublicKey: string
  serverPrivateKey: string
}

const RECORD_SIZE = 4096
const encoder = new TextEncoder()

export function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Importe une clé P-256 à partir du point public brut et, pour une clé privée, du scalaire d. */
function importEcKey(
  publicKey: string,
  privateKey: string | null,
  algorithm: 'ECDSA' | 'ECDH',
): Promise<CryptoKey> {
  const point = fromBase64Url(publicKey)
  if (point.length !== 65 || point[0] !== 4) throw new Error('Clé publique P-256 invalide')
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: toBase64Url(point.slice(1, 33)),
    y: toBase64Url(point.slice(33)),
    ext: true,
  }
  if (privateKey) jwk.d = privateKey
  const usages: ('sign' | 'verify' | 'deriveBits')[] = privateKey
    ? algorithm === 'ECDSA'
      ? ['sign']
      : ['deriveBits']
    : algorithm === 'ECDSA'
      ? ['verify']
      : []
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: algorithm, namedCurve: 'P-256' },
    false,
    usages,
  )
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

/** Jeton VAPID pour l'origine du service de push (valable 12 h). */
export async function vapidToken(
  endpoint: string,
  keys: VapidKeys,
  now = Date.now(),
): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = toBase64Url(
    encoder.encode(
      JSON.stringify({
        aud: new URL(endpoint).origin,
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: keys.subject,
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const key = await importEcKey(keys.publicKey, keys.privateKey, 'ECDSA')
  // WebCrypto produit déjà la signature r‖s (64 octets) attendue par JWS.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    encoder.encode(unsigned),
  )
  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`
}

/** Vérifie un jeton VAPID (tests). */
export async function verifyVapidToken(token: string, publicKey: string): Promise<boolean> {
  const [header, claims, signature] = token.split('.')
  if (!header || !claims || !signature) return false
  const key = await importEcKey(publicKey, null, 'ECDSA')
  return crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    fromBase64Url(signature),
    encoder.encode(`${header}.${claims}`),
  )
}

/** Chiffre un contenu pour un abonnement (corps `aes128gcm` complet, en-tête compris). */
export async function encryptPayload(
  payload: Uint8Array,
  target: Pick<PushTarget, 'p256dh' | 'auth'>,
  overrides?: EncryptionOverrides,
): Promise<Uint8Array<ArrayBuffer>> {
  const uaPublic = fromBase64Url(target.p256dh)
  const authSecret = fromBase64Url(target.auth)
  const salt = overrides?.salt ?? crypto.getRandomValues(new Uint8Array(16))

  let asPublic: Uint8Array
  let asPrivate: CryptoKey
  if (overrides) {
    asPublic = fromBase64Url(overrides.serverPublicKey)
    asPrivate = await importEcKey(overrides.serverPublicKey, overrides.serverPrivateKey, 'ECDH')
  } else {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair
    asPublic = new Uint8Array((await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer)
    asPrivate = pair.privateKey
  }

  const uaKey = await importEcKey(target.p256dh, null, 'ECDH')
  const ecdhSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      // Nom standard `public` (les types Workers l'exposent sous `$public`).
      { name: 'ECDH', public: uaKey } as unknown as SubtleCryptoDeriveKeyAlgorithm,
      asPrivate,
      256,
    ),
  )

  const keyInfo = concat(encoder.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  // Délimiteur 0x02 : dernier (et unique) enregistrement, sans remplissage.
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    concat(payload, new Uint8Array([2])),
  )

  const header = new Uint8Array(16 + 4 + 1)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, RECORD_SIZE)
  header[20] = asPublic.length
  return concat(header, asPublic, new Uint8Array(ciphertext))
}

/** Envoie un message push ; renvoie le statut HTTP du service de push. */
export async function sendPush(
  target: PushTarget,
  payload: string,
  keys: VapidKeys,
  options: { ttl?: number; urgency?: 'low' | 'normal' | 'high'; topic?: string } = {},
): Promise<number> {
  const body = await encryptPayload(encoder.encode(payload), target)
  const headers: Record<string, string> = {
    Authorization: `vapid t=${await vapidToken(target.endpoint, keys)}, k=${keys.publicKey}`,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(options.ttl ?? 86_400),
    Urgency: options.urgency ?? 'normal',
  }
  // Topic : un message en attente de même sujet est remplacé (≤ 32 caractères base64url).
  if (options.topic) headers.Topic = options.topic.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32)
  const response = await fetch(target.endpoint, { method: 'POST', headers, body })
  return response.status
}
