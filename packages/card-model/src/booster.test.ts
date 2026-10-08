import { describe, expect, it } from 'vitest'
import { drawBooster, BOOSTER_SIZE } from './booster'
import { createBlankCard } from './defaults'
import { RARITY_INFO } from './rarities'
import type { Rarity } from './types'

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function card(rarity: Rarity) {
  const c = createBlankCard('Alice')
  c.rarity = rarity
  return c
}

const pool = [card('common'), card('common'), card('uncommon'), card('rare'), card('legendary')]

describe('drawBooster', () => {
  it('renvoie un tableau vide pour un pool vide', () => {
    expect(drawBooster([])).toEqual([])
  })

  it('tire le bon nombre de cartes, issues du pool', () => {
    const drawn = drawBooster(pool, { rng: seeded(1) })
    expect(drawn).toHaveLength(BOOSTER_SIZE)
    for (const c of drawn) expect(pool).toContain(c)
  })

  it('garantit une carte rare ou mieux, révélée en dernier', () => {
    for (let seed = 0; seed < 50; seed++) {
      const drawn = drawBooster(pool, { rng: seeded(seed) })
      const ranks = drawn.map((c) => RARITY_INFO[c.rarity].rank)
      expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
      expect(ranks.at(-1)).toBeGreaterThanOrEqual(RARITY_INFO.rare.rank)
    }
  })

  it('fonctionne avec un pool d’une seule carte commune (doublons)', () => {
    const only = card('common')
    const drawn = drawBooster([only], { size: 3, rng: seeded(2) })
    expect(drawn).toEqual([only, only, only])
  })
})
