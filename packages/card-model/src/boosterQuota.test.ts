import { describe, expect, it } from 'vitest'
import { boosterStock, consumeBooster, initialBoosterAnchor } from './boosterQuota'

const DAY = 86_400
const settings = { intervalSeconds: DAY, maxStock: 3 }
const now = new Date('2026-10-08T12:00:00.000Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

describe('boosterStock', () => {
  it('donne un booster à un nouveau joueur', () => {
    const stock = boosterStock(
      { anchor: initialBoosterAnchor(settings, now), bonus: 0 },
      settings,
      now,
    )
    expect(stock).toMatchObject({ periodic: 1, bonus: 0, total: 1 })
    expect(stock.nextAt).toBe(new Date(now.getTime() + DAY * 1000).toISOString())
  })

  it('plafonne le stock périodique', () => {
    const stock = boosterStock({ anchor: ago(30 * DAY), bonus: 2 }, settings, now)
    expect(stock).toEqual({ periodic: 3, bonus: 2, total: 5, nextAt: null })
  })

  it('suit un changement d’intervalle (par jour → par heure)', () => {
    const hourly = { intervalSeconds: 3600, maxStock: 3 }
    expect(boosterStock({ anchor: ago(2.5 * 3600), bonus: 0 }, hourly, now).periodic).toBe(2)
  })

  it('ne renvoie rien de négatif avec une ancre dans le futur', () => {
    const stock = boosterStock({ anchor: ago(-DAY), bonus: 0 }, settings, now)
    expect(stock.periodic).toBe(0)
  })
})

describe('consumeBooster', () => {
  it('consomme le stock périodique avant les bonus', () => {
    const result = consumeBooster({ anchor: ago(1.5 * DAY), bonus: 1 }, settings, now)
    expect(result?.source).toBe('periodic')
    expect(result?.state.bonus).toBe(1)
    expect(boosterStock(result!.state, settings, now).periodic).toBe(0)
  })

  it('ne perd pas le temps déjà écoulé vers la recharge suivante', () => {
    const result = consumeBooster({ anchor: ago(1.5 * DAY), bonus: 0 }, settings, now)!
    const next = boosterStock(result.state, settings, now).nextAt
    expect(next).toBe(new Date(now.getTime() + 0.5 * DAY * 1000).toISOString())
  })

  it('repart du plafond quand le stock était plein', () => {
    const result = consumeBooster({ anchor: ago(30 * DAY), bonus: 0 }, settings, now)!
    expect(boosterStock(result.state, settings, now).periodic).toBe(2)
  })

  it('utilise ensuite les bonus', () => {
    const result = consumeBooster({ anchor: ago(0), bonus: 2 }, settings, now)
    expect(result).toEqual({ state: { anchor: ago(0), bonus: 1 }, source: 'bonus' })
  })

  it('refuse quand il n’y a rien à ouvrir', () => {
    expect(consumeBooster({ anchor: ago(0), bonus: 0 }, settings, now)).toBeNull()
  })
})
