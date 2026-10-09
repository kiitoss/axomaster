import { boosterRefillNotification, boosterStock } from '@axomaster/card-model'
import type { Env } from '../env'
import { notifyUsers, vapidKeys } from '../lib/notify'
import { loadSettings } from '../lib/settings'

interface Candidate {
  id: string
  booster_anchor: string
  bonus_boosters: number
  booster_notify_at: string | null
}

/**
 * Tâche planifiée : notifie chaque recharge de booster périodique.
 *
 * `users.booster_notify_at` mémorise l'heure de la prochaine recharge à annoncer. Une valeur
 * échue déclenche une notification (une seule, même si plusieurs recharges ont été manquées),
 * puis est recalée sur la recharge suivante. Une valeur NULL (migration, réserve pleine,
 * réglages modifiés) est simplement recalculée, sans envoi.
 * Seuls les joueurs ayant au moins un appareil abonné sont concernés.
 */
export async function notifyBoosterRefills(env: Env, now = new Date()): Promise<number> {
  if (!vapidKeys(env)) return 0
  const nowIso = now.toISOString()
  const [settings, { results }] = await Promise.all([
    loadSettings(env.DB),
    env.DB.prepare(
      `SELECT id, booster_anchor, bonus_boosters, booster_notify_at FROM users
       WHERE disabled = 0
         AND (booster_notify_at IS NULL OR booster_notify_at <= ?)
         AND EXISTS (SELECT 1 FROM push_subscriptions ps WHERE ps.user_id = users.id)`,
    )
      .bind(nowIso)
      .all<Candidate>(),
  ])
  if (!results.length) return 0

  const updates: D1PreparedStatement[] = []
  const notifications: Promise<void>[] = []
  for (const user of results) {
    const stock = boosterStock(
      { anchor: user.booster_anchor, bonus: user.bonus_boosters },
      settings,
      now,
    )
    if (user.booster_notify_at && stock.periodic > 0)
      notifications.push(notifyUsers(env, [user.id], boosterRefillNotification(stock.total)))
    // Garde : on ne touche pas une ligne modifiée entre-temps (booster ouvert pendant la tâche).
    updates.push(
      env.DB.prepare(
        'UPDATE users SET booster_notify_at = ? WHERE id = ? AND booster_anchor = ? AND booster_notify_at IS ?',
      ).bind(stock.nextAt, user.id, user.booster_anchor, user.booster_notify_at),
    )
  }
  await env.DB.batch(updates)
  await Promise.all(notifications)
  return notifications.length
}
