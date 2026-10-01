import type { Card, Category, ImageLayer, ShapeLayer, TextLayer } from './types'

/** Dimensions de référence d'une carte (ratio 63 × 88 mm). */
export const CARD_WIDTH = 630
export const CARD_HEIGHT = 880

export function newId(): string {
  return globalThis.crypto.randomUUID()
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function formatNumber(n: number | null): string {
  return n == null ? '' : String(n).padStart(3, '0')
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'collaborateurs', name: 'Collaborateurs', color: '#3f5d8c' },
  { id: 'evenements', name: 'Événements', color: '#a8832f' },
  { id: 'projets', name: 'Projets & clients', color: '#5d7d68' },
]

export function createBlankCard(author: string, categoryId: string | null = null): Card {
  const now = nowIso()
  return {
    id: newId(),
    name: '',
    subtitle: '',
    description: '',
    categoryId,
    rarity: 'common',
    number: null,
    photo: { imageId: null, x: 50, y: 50, scale: 1 },
    layers: [],
    author,
    source: { kind: 'local' },
    createdAt: now,
    updatedAt: now,
  }
}

const layerDefaults = { rotation: 0, opacity: 1, visible: true, locked: false }

export function createTextLayer(name = 'Texte'): TextLayer {
  return {
    ...layerDefaults,
    id: newId(),
    type: 'text',
    name,
    x: 15,
    y: 42,
    w: 70,
    h: 10,
    text: 'Votre texte',
    font: 'serif',
    size: 48,
    weight: 600,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    align: 'center',
    color: '#1d1b18',
  }
}

export function createImageLayer(imageId: string | null, name = 'Image'): ImageLayer {
  return {
    ...layerDefaults,
    id: newId(),
    type: 'image',
    name,
    x: 30,
    y: 30,
    w: 40,
    h: 28.6,
    imageId,
    fit: 'contain',
    radius: 0,
  }
}

export function createShapeLayer(shape: ShapeLayer['shape'], name = 'Forme'): ShapeLayer {
  const isLine = shape === 'line'
  return {
    ...layerDefaults,
    id: newId(),
    type: 'shape',
    name,
    x: 35,
    y: isLine ? 50 : 40,
    w: 30,
    h: isLine ? 1 : 21.5,
    shape,
    fill: isLine ? 'transparent' : '#a8832f',
    stroke: isLine ? '#1d1b18' : 'transparent',
    strokeWidth: isLine ? 3 : 0,
    radius: 0,
  }
}

/** Identifiants d'images référencés par une carte (photo + calques image). */
export function cardImageIds(card: Card): string[] {
  const ids = new Set<string>()
  if (card.photo.imageId) ids.add(card.photo.imageId)
  for (const layer of card.layers) {
    if (layer.type === 'image' && layer.imageId) ids.add(layer.imageId)
  }
  return [...ids]
}
