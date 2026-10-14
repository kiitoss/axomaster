import { describe, expect, it } from 'vitest'
import { creationQuota, creationWindowStart } from './creationQuota'

const DAY = 86_400
const settings = { creationLimit: 3, creationWindowSeconds: 7 * DAY }
const now = new Date('2026-10-08T12:00:00.000Z')
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString()

describe('creationQuota', () => {
  it('laisse toute la limite à un nouveau joueur', () => {
    expect(creationQuota([], settings, now)).toEqual({
      limit: 3,
      windowSeconds: 7 * DAY,
      used: 0,
      remaining: 3,
      nextAt: null,
    })
  })

  it('ignore les créations sorties de la fenêtre', () => {
    const quota = creationQuota([ago(8 * DAY), ago(2 * DAY)], settings, now)
    expect(quota).toMatchObject({ used: 1, remaining: 2, nextAt: null })
  })

  it('annonce le prochain crédit quand la limite est atteinte', () => {
    const quota = creationQuota([ago(1 * DAY), ago(5 * DAY), ago(3 * DAY)], settings, now)
    expect(quota).toMatchObject({ used: 3, remaining: 0 })
    // La plus ancienne (il y a 5 jours) libère un crédit dans 2 jours.
    expect(quota.nextAt).toBe(ago(-2 * DAY))
  })

  it('suit une limite abaissée sous le nombre de créations récentes', () => {
    const lower = { ...settings, creationLimit: 1 }
    const quota = creationQuota([ago(1 * DAY), ago(5 * DAY), ago(3 * DAY)], lower, now)
    expect(quota).toMatchObject({ used: 3, remaining: 0 })
    // Les trois doivent sortir de la fenêtre : la plus récente (il y a 1 jour) dans 6 jours.
    expect(quota.nextAt).toBe(ago(-6 * DAY))
  })

  it('n’annonce rien quand la création est fermée', () => {
    const closed = { ...settings, creationLimit: 0 }
    expect(creationQuota([ago(DAY)], closed, now)).toMatchObject({ remaining: 0, nextAt: null })
  })

  it('calcule le début de la fenêtre', () => {
    expect(creationWindowStart(settings, now)).toBe(ago(7 * DAY))
  })
})
