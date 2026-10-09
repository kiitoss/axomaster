import { describe, expect, it } from 'vitest'
import {
  encryptPayload,
  fromBase64Url,
  toBase64Url,
  vapidToken,
  verifyVapidToken,
} from '../src/lib/webpush'
import { TEST_VAPID } from './push-helpers'

describe('webpush', () => {
  // RFC 8291, section 5 : exemple complet de chiffrement.
  it('chiffre comme le vecteur de test de la RFC 8291', async () => {
    const body = await encryptPayload(
      new TextEncoder().encode('When I grow up, I want to be a watermelon'),
      {
        p256dh:
          'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      {
        salt: fromBase64Url('DGv6ra1nlYgDCS1FRnbzlw'),
        serverPublicKey:
          'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
        serverPrivateKey: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
      },
    )
    expect(toBase64Url(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })

  it('signe un jeton VAPID pour l’origine du service de push', async () => {
    const now = Date.parse('2026-10-09T12:00:00Z')
    const token = await vapidToken('https://push.example.net/send/abc', TEST_VAPID, now)
    expect(await verifyVapidToken(token, TEST_VAPID.publicKey)).toBe(true)
    const claims = JSON.parse(new TextDecoder().decode(fromBase64Url(token.split('.')[1]!)))
    expect(claims).toEqual({
      aud: 'https://push.example.net',
      exp: now / 1000 + 12 * 3600,
      sub: TEST_VAPID.subject,
    })
  })
})
