/**
 * Génère une paire de clés VAPID pour les notifications push.
 *
 *   pnpm --filter @axomaster/api vapid:keys
 *
 * En local : copier les lignes dans `apps/api/.dev.vars`, avec un contact réel.
 * En production : `wrangler secret put` pour VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY et VAPID_SUBJECT.
 * Changer de clés invalide tous les abonnements existants (les joueurs doivent réactiver).
 */
import { Buffer } from 'node:buffer'

const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
  'sign',
  'verify',
])) as CryptoKeyPair
const publicKey = Buffer.from(await crypto.subtle.exportKey('raw', pair.publicKey))
const { d } = await crypto.subtle.exportKey('jwk', pair.privateKey)

console.log(`VAPID_PUBLIC_KEY=${publicKey.toString('base64url')}`)
console.log(`VAPID_PRIVATE_KEY=${d}`)
console.log('VAPID_SUBJECT=mailto:<adresse de contact>')
