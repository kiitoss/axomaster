import type { NotificationPayload } from '@axomaster/card-model'
import type { Env } from '../env'
import { placeholders } from './http'
import { sendPush, type PushTarget, type VapidKeys } from './webpush'

/**
 * Configuration VAPID complète (clés et contact), ou `null` : les notifications sont alors
 * désactivées. Le contact est exigé par les services de push (Apple notamment).
 */
export function vapidKeys(env: Env): VapidKeys | null {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return null
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  }
}

/**
 * Envoie une notification à tous les appareils des joueurs donnés (actifs uniquement).
 * Ne lève jamais : un échec d'envoi ne doit pas faire échouer l'action qui l'a déclenché.
 * Les abonnements expirés (404 / 410) sont supprimés.
 */
export async function notifyUsers(
  env: Env,
  userIds: string[],
  payload: NotificationPayload,
): Promise<void> {
  const keys = vapidKeys(env)
  const ids = [...new Set(userIds)]
  if (!keys || !ids.length) return
  try {
    const { results } = await env.DB.prepare(
      `SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id
       WHERE u.disabled = 0 AND ps.user_id IN (${placeholders(ids.length)})`,
    )
      .bind(...ids)
      .all<PushTarget>()
    await sendToTargets(env, results, payload, keys)
  } catch (err) {
    console.error('Notification push impossible', err)
  }
}

/** Notifie tous les joueurs actifs ayant un abonnement. */
export async function notifyAllUsers(env: Env, payload: NotificationPayload): Promise<void> {
  const keys = vapidKeys(env)
  if (!keys) return
  try {
    const { results } = await env.DB.prepare(
      `SELECT ps.endpoint, ps.p256dh, ps.auth FROM push_subscriptions ps
       JOIN users u ON u.id = ps.user_id WHERE u.disabled = 0`,
    ).all<PushTarget>()
    await sendToTargets(env, results, payload, keys)
  } catch (err) {
    console.error('Notification push impossible', err)
  }
}

async function sendToTargets(
  env: Env,
  targets: PushTarget[],
  payload: NotificationPayload,
  keys: VapidKeys,
) {
  const body = JSON.stringify(payload)
  const statuses = await Promise.allSettled(
    targets.map((target) => sendPush(target, body, keys, { topic: payload.tag })),
  )
  const expired = targets.filter((_, i) => {
    const status = statuses[i]
    return status?.status === 'fulfilled' && (status.value === 404 || status.value === 410)
  })
  for (const [i, status] of statuses.entries()) {
    if (status.status === 'rejected') console.error('Envoi push échoué', status.reason)
    else if (status.value >= 400 && status.value !== 404 && status.value !== 410)
      console.error(`Envoi push refusé (${status.value})`, targets[i]?.endpoint)
  }
  if (expired.length)
    await env.DB.batch(
      expired.map((target) =>
        env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(target.endpoint),
      ),
    )
}
