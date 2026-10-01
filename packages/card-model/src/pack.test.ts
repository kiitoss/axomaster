import { describe, expect, it } from 'vitest'
import { createBlankCard, createShapeLayer, createTextLayer, DEFAULT_CATEGORIES } from './defaults'
import { createPack, parsePack } from './pack'

function samplePack() {
  const card = createBlankCard('Alice', 'collaborateurs')
  card.name = 'Bob'
  card.rarity = 'legendary'
  card.photo.imageId = 'img-1'
  card.layers.push(createTextLayer(), createShapeLayer('ellipse'))
  return createPack({
    author: 'Alice',
    cards: [card],
    categories: DEFAULT_CATEGORIES,
    images: { 'img-1': 'data:image/webp;base64,AAAA' },
  })
}

describe('parsePack', () => {
  it('relit un paquet exporté (objet et chaîne JSON)', () => {
    const pack = samplePack()
    expect(parsePack(pack)).toEqual({ ok: true, pack })
    expect(parsePack(JSON.stringify(pack))).toEqual({ ok: true, pack })
  })

  it('rejette un JSON invalide', () => {
    expect(parsePack('{oops').ok).toBe(false)
  })

  it("rejette un fichier qui n'est pas un paquet", () => {
    expect(parsePack({ hello: 'world' }).ok).toBe(false)
  })

  it('rejette une version future', () => {
    const res = parsePack({ ...samplePack(), version: 99 })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('v99')
  })

  it('signale le champ fautif', () => {
    const pack = samplePack() as unknown as { cards: { rarity: string }[] }
    pack.cards[0]!.rarity = 'mythique'
    const res = parsePack(pack)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toContain('cards.0.rarity')
  })

  it("rejette une image qui n'est pas une data URL", () => {
    const pack = { ...samplePack(), images: { x: 'https://example.com/a.png' } }
    expect(parsePack(pack).ok).toBe(false)
  })
})
