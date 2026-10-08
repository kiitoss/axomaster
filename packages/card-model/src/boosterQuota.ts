/**
 * Quota de boosters d'un joueur : un stock périodique qui se recharge (un booster toutes les
 * `intervalSeconds`, plafonné à `maxStock`) et des boosters bonus offerts par l'admin, sans
 * plafond ni expiration. Logique pure, exécutée côté serveur et testée ici.
 */
export interface BoosterQuotaSettings {
  intervalSeconds: number
  maxStock: number
}

export interface BoosterQuotaState {
  /** Instant de référence du stock périodique (ISO). */
  anchor: string
  /** Boosters offerts restants. */
  bonus: number
}

export interface BoosterStock {
  periodic: number
  bonus: number
  total: number
  /** Prochaine recharge (ISO), `null` si le stock périodique est plein. */
  nextAt: string | null
}

/** Ancre effective : au-delà du plafond, le temps écoulé ne compte plus. */
function effectiveAnchor(state: BoosterQuotaState, settings: BoosterQuotaSettings, now: Date) {
  const interval = settings.intervalSeconds * 1000
  const anchor = new Date(state.anchor).getTime()
  return Math.max(
    Number.isFinite(anchor) ? anchor : 0,
    now.getTime() - settings.maxStock * interval,
  )
}

export function boosterStock(
  state: BoosterQuotaState,
  settings: BoosterQuotaSettings,
  now: Date = new Date(),
): BoosterStock {
  const interval = settings.intervalSeconds * 1000
  const anchor = effectiveAnchor(state, settings, now)
  const periodic = Math.max(
    0,
    Math.min(settings.maxStock, Math.floor((now.getTime() - anchor) / interval)),
  )
  const bonus = Math.max(0, state.bonus)
  return {
    periodic,
    bonus,
    total: periodic + bonus,
    nextAt:
      periodic >= settings.maxStock
        ? null
        : new Date(anchor + (periodic + 1) * interval).toISOString(),
  }
}

/**
 * Consomme un booster : d'abord le stock périodique (qui se recharge), puis les bonus (qui
 * n'expirent pas). Renvoie le nouvel état, ou `null` s'il n'y a rien à ouvrir.
 */
export function consumeBooster(
  state: BoosterQuotaState,
  settings: BoosterQuotaSettings,
  now: Date = new Date(),
): { state: BoosterQuotaState; source: 'periodic' | 'bonus' } | null {
  const stock = boosterStock(state, settings, now)
  if (stock.periodic > 0) {
    const anchor = effectiveAnchor(state, settings, now) + settings.intervalSeconds * 1000
    return {
      state: { anchor: new Date(anchor).toISOString(), bonus: stock.bonus },
      source: 'periodic',
    }
  }
  if (stock.bonus > 0) {
    return { state: { anchor: state.anchor, bonus: stock.bonus - 1 }, source: 'bonus' }
  }
  return null
}

/** État initial d'un nouveau joueur : un booster disponible tout de suite. */
export function initialBoosterAnchor(settings: BoosterQuotaSettings, now: Date = new Date()) {
  return new Date(now.getTime() - settings.intervalSeconds * 1000).toISOString()
}
