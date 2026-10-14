/**
 * Quota de créations de cartes d'un joueur : au plus `limit` créations sur une fenêtre glissante
 * de `windowSeconds`. Les admins n'y sont pas soumis. Logique pure, exécutée côté serveur et
 * testée ici ; le serveur revérifie la limite dans la requête d'insertion.
 */
export interface CreationQuotaSettings {
  /** Créations autorisées par fenêtre ; 0 ferme la création aux joueurs. */
  creationLimit: number
  creationWindowSeconds: number
}

export interface CreationQuota {
  limit: number
  windowSeconds: number
  used: number
  remaining: number
  /** Prochain crédit disponible (ISO), `null` s'il en reste ou si la création est fermée. */
  nextAt: string | null
}

/** Début de la fenêtre glissante (ISO) : seules les créations postérieures comptent. */
export function creationWindowStart(settings: CreationQuotaSettings, now: Date = new Date()) {
  return new Date(now.getTime() - settings.creationWindowSeconds * 1000).toISOString()
}

/** `createdAt` : dates (ISO) des créations du joueur, dans n'importe quel ordre. */
export function creationQuota(
  createdAt: string[],
  settings: CreationQuotaSettings,
  now: Date = new Date(),
): CreationQuota {
  const window = settings.creationWindowSeconds * 1000
  const start = now.getTime() - window
  const recent = createdAt
    .map((date) => new Date(date).getTime())
    .filter((time) => Number.isFinite(time) && time > start)
    .sort((a, b) => a - b)
  const limit = settings.creationLimit
  const used = recent.length
  const remaining = Math.max(0, limit - used)
  // Il faut que `used - limit + 1` créations sortent de la fenêtre pour libérer un crédit.
  const freeing = recent[used - limit]
  return {
    limit,
    windowSeconds: settings.creationWindowSeconds,
    used,
    remaining,
    nextAt:
      remaining > 0 || limit <= 0 || freeing === undefined
        ? null
        : new Date(freeing + window).toISOString(),
  }
}
