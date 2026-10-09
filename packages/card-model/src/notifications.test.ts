import { describe, expect, it } from 'vitest'
import {
  boosterRefillNotification,
  giftNotification,
  tradeRequestNotification,
  tradeResolvedNotification,
} from './notifications'

describe('notifications', () => {
  it('accorde le nombre de boosters rechargés', () => {
    expect(boosterRefillNotification(1).body).toBe('Vous avez 1 booster à ouvrir.')
    expect(boosterRefillNotification(3).body).toBe('Vous avez 3 boosters à ouvrir.')
  })

  it('reprend le message d’un cadeau tel quel', () => {
    const notif = giftNotification(2, '  Bravo pour le salon !  ')
    expect(notif).toMatchObject({ title: '2 boosters offerts !', body: 'Bravo pour le salon !' })
    expect(notif.url).toBe('./#/boosters')
  })

  it('a un texte par défaut sans message', () => {
    expect(giftNotification(1, '')).toMatchObject({
      title: 'Un booster offert !',
      body: 'Un cadeau vous attend dans l’onglet Boosters.',
    })
  })

  it('décrit les échanges', () => {
    expect(tradeRequestNotification('t1', 'Alice', '').body).toBe('Alice vous propose un échange.')
    expect(tradeRequestNotification('t1', 'Alice', 'Ta rare ?').body).toBe('Alice : « Ta rare ? »')
    expect(tradeResolvedNotification('t1', 'Bob', 'declined')).toMatchObject({
      title: 'Échange refusé',
      tag: 'trade-t1',
      url: './#/echanges',
    })
  })
})
