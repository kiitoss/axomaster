import { RARITY_INFO } from './rarities'
import type { Card, Rarity } from './types'

/** Nombre de cartes dans un booster. */
export const BOOSTER_SIZE = 5

/** Poids relatifs de tirage par rareté. */
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 60,
  uncommon: 25,
  rare: 10,
  epic: 4,
  legendary: 1,
}

export interface DrawOptions {
  size?: number
  /** Générateur aléatoire dans [0, 1[ (injectable pour les tests). */
  rng?: () => number
}

/**
 * Tire un booster dans un ensemble de cartes, avec remise (les doublons sont possibles).
 * La rareté est tirée selon `RARITY_WEIGHTS` parmi celles présentes dans le pool ; le dernier
 * emplacement est garanti rare ou mieux si possible. Le résultat est trié par rareté croissante :
 * la meilleure carte se révèle en dernier.
 */
export function drawBooster(
  pool: Card[],
  { size = BOOSTER_SIZE, rng = Math.random }: DrawOptions = {},
): Card[] {
  if (!pool.length || size <= 0) return []

  const byRarity = new Map<Rarity, Card[]>()
  for (const card of pool) {
    const list = byRarity.get(card.rarity)
    if (list) list.push(card)
    else byRarity.set(card.rarity, [card])
  }

  const pick = <T>(list: T[]) => list[Math.floor(rng() * list.length)]!

  function drawFrom(rarities: Rarity[]): Card {
    const total = rarities.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0)
    let roll = rng() * total
    let chosen = rarities[rarities.length - 1]!
    for (const r of rarities) {
      roll -= RARITY_WEIGHTS[r]
      if (roll < 0) {
        chosen = r
        break
      }
    }
    return pick(byRarity.get(chosen)!)
  }

  const present = [...byRarity.keys()]
  const premium = present.filter((r) => RARITY_INFO[r].rank >= RARITY_INFO.rare.rank)

  const drawn: Card[] = []
  for (let i = 0; i < size - 1; i++) drawn.push(drawFrom(present))
  drawn.push(drawFrom(premium.length ? premium : present))

  return drawn.sort((a, b) => RARITY_INFO[a.rarity].rank - RARITY_INFO[b.rarity].rank)
}
