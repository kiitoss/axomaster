import { z } from 'zod'

/** Format du fichier d'échange. Incrémenter quand le schéma change (et ajouter une migration). */
export const PACK_FORMAT = 'axomaster.pack'
export const PACK_VERSION = 1

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const
export const raritySchema = z.enum(RARITIES)

const id = z.string().min(1).max(100)
const color = z.string().max(64)
const isoDate = z.string().max(40)

export const categorySchema = z.object({
  id,
  name: z.string().max(80),
  color,
})

export const photoSchema = z.object({
  imageId: id.nullable(),
  /** Point focal horizontal, 0–100 %. */
  x: z.number().min(0).max(100),
  /** Point focal vertical, 0–100 %. */
  y: z.number().min(0).max(100),
  /** Zoom, 1 = remplissage exact. */
  scale: z.number().min(1).max(5),
})

/** Champs communs aux calques libres. Les coordonnées sont en % de la carte. */
const layerBase = {
  id,
  name: z.string().max(80),
  x: z.number(),
  y: z.number(),
  w: z.number().min(0),
  h: z.number().min(0),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  visible: z.boolean(),
  locked: z.boolean(),
}

export const textLayerSchema = z.object({
  ...layerBase,
  type: z.literal('text'),
  text: z.string().max(2000),
  font: z.enum(['serif', 'sans']),
  /** Taille en px pour une carte de référence de 630 × 880. */
  size: z.number().min(4).max(400),
  weight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700)]),
  italic: z.boolean(),
  uppercase: z.boolean(),
  letterSpacing: z.number().min(-0.2).max(1),
  align: z.enum(['left', 'center', 'right']),
  color,
})

export const imageLayerSchema = z.object({
  ...layerBase,
  type: z.literal('image'),
  imageId: id.nullable(),
  fit: z.enum(['cover', 'contain']),
  radius: z.number().min(0).max(50),
})

export const shapeLayerSchema = z.object({
  ...layerBase,
  type: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'line']),
  fill: color,
  stroke: color,
  strokeWidth: z.number().min(0).max(100),
  radius: z.number().min(0).max(50),
})

export const layerSchema = z.discriminatedUnion('type', [
  textLayerSchema,
  imageLayerSchema,
  shapeLayerSchema,
])

export const cardSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }),
  z.object({ kind: z.literal('imported'), from: z.string().max(80), importedAt: isoDate }),
])

export const cardSchema = z.object({
  id,
  name: z.string().max(120),
  /** Poste pour un collaborateur, date ou lieu pour un événement. */
  subtitle: z.string().max(160),
  description: z.string().max(1000),
  categoryId: id.nullable(),
  rarity: raritySchema,
  number: z.number().int().min(0).max(9999).nullable(),
  photo: photoSchema,
  layers: z.array(layerSchema).max(100),
  author: z.string().max(80),
  source: cardSourceSchema,
  createdAt: isoDate,
  updatedAt: isoDate,
})

export const cardPackSchema = z.object({
  format: z.literal(PACK_FORMAT),
  version: z.literal(PACK_VERSION),
  exportedAt: isoDate,
  author: z.string().max(80),
  categories: z.array(categorySchema),
  cards: z.array(cardSchema),
  /** imageId → data URL (base64). */
  images: z.record(z.string(), z.string().startsWith('data:image/')),
})
