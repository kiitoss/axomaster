import { z } from 'zod'

/**
 * Notifications push : contenu envoyé par le Worker et affiché par le service worker.
 * Les constructeurs sont partagés avec le front (aperçu admin) pour garantir le même texte.
 */

export const notificationPayloadSchema = z.object({
  title: z.string().max(120),
  body: z.string().max(400),
  /** URL relative au scope de l'app (hash router). */
  url: z.string().max(200),
  /** Une notification remplace la précédente de même étiquette. */
  tag: z.string().max(100),
})

export type NotificationPayload = z.infer<typeof notificationPayloadSchema>

/** Longueur maximale du message personnalisé d'un cadeau. */
export const GIFT_MESSAGE_MAX = 140

const BOOSTERS_URL = './#/boosters'
const TRADES_URL = './#/echanges'

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`

export function boosterRefillNotification(total: number): NotificationPayload {
  return {
    title: 'Un booster vous attend',
    body: `Vous avez ${plural(total, 'booster')} à ouvrir.`,
    url: BOOSTERS_URL,
    tag: 'booster',
  }
}

export function giftNotification(count: number, message: string): NotificationPayload {
  const text = message.trim()
  return {
    title: count > 1 ? `${count} boosters offerts !` : 'Un booster offert !',
    body: text || 'Un cadeau vous attend dans l’onglet Boosters.',
    url: BOOSTERS_URL,
    tag: 'gift',
  }
}

export function tradeRequestNotification(
  tradeId: string,
  fromName: string,
  message: string,
): NotificationPayload {
  const text = message.trim()
  return {
    title: 'Nouvelle proposition d’échange',
    body: text ? `${fromName} : « ${text} »` : `${fromName} vous propose un échange.`,
    url: TRADES_URL,
    tag: `trade-${tradeId}`,
  }
}

export type TradeOutcome = 'accepted' | 'declined' | 'failed'

export function tradeResolvedNotification(
  tradeId: string,
  toName: string,
  outcome: TradeOutcome,
): NotificationPayload {
  const texts: Record<TradeOutcome, [string, string]> = {
    accepted: ['Échange accepté', `${toName} a accepté votre échange.`],
    declined: ['Échange refusé', `${toName} a refusé votre échange.`],
    failed: [
      'Échange impossible',
      `L’échange avec ${toName} n’a pas pu avoir lieu : des cartes ne sont plus disponibles.`,
    ],
  }
  const [title, body] = texts[outcome]
  return { title, body, url: TRADES_URL, tag: `trade-${tradeId}` }
}
