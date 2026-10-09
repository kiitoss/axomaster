import type { NotificationPayload } from '@axomaster/card-model'
import { toBase64Url } from '../src/lib/webpush'

/** Clés VAPID de test (aussi déclarées dans vitest.config.ts). */
export const TEST_VAPID = {
  publicKey:
    'BKgZAxussPn01xfamSN8kIieyLLumDTOJOawtVABUo2MDodsmLgY1qjjEJq-GQUrHWyUiEAhnSmbHq3Ceu15JUE',
  privateKey: 'WDhlKsdgVCIE0_ZT7ce90KZKzsY4DtRB_9tDcFVc-yo',
  subject: 'mailto:test@axomaster.test',
}

/** Faux navigateur abonné : il sait déchiffrer les messages qui lui sont destinés. */
export interface FakeDevice {
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
  decrypt(body: ArrayBuffer): Promise<NotificationPayload>
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    bytes * 8,
  )
  return new Uint8Array(bits)
}

export async function fakeDevice(endpoint: string): Promise<FakeDevice> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const publicKey = new Uint8Array(
    (await crypto.subtle.exportKey('raw', pair.publicKey)) as ArrayBuffer,
  )
  const auth = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()

  return {
    subscription: { endpoint, keys: { p256dh: toBase64Url(publicKey), auth: toBase64Url(auth) } },
    // Déchiffrement aes128gcm côté navigateur (RFC 8291), un seul enregistrement.
    async decrypt(buffer) {
      const body = new Uint8Array(buffer)
      const salt = body.slice(0, 16)
      const idLength = body[20]!
      const serverKey = body.slice(21, 21 + idLength)
      const ciphertext = body.slice(21 + idLength)
      const server = await crypto.subtle.importKey(
        'raw',
        serverKey,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        [],
      )
      const secret = new Uint8Array(
        await crypto.subtle.deriveBits(
          { name: 'ECDH', public: server } as unknown as SubtleCryptoDeriveKeyAlgorithm,
          pair.privateKey,
          256,
        ),
      )
      const ikm = await hkdf(
        auth,
        secret,
        concat(encoder.encode('WebPush: info\0'), publicKey, serverKey),
        32,
      )
      const cek = await hkdf(salt, ikm, encoder.encode('Content-Encoding: aes128gcm\0'), 16)
      const nonce = await hkdf(salt, ikm, encoder.encode('Content-Encoding: nonce\0'), 12)
      const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt'])
      const plain = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext),
      )
      // Retire le délimiteur final (0x02).
      return JSON.parse(new TextDecoder().decode(plain.slice(0, plain.lastIndexOf(2))))
    },
  }
}
