import type { z } from 'zod'
import type {
  cardPackSchema,
  cardSchema,
  cardSourceSchema,
  categorySchema,
  imageLayerSchema,
  layerSchema,
  photoSchema,
  raritySchema,
  shapeLayerSchema,
  textLayerSchema,
} from './schema'

export type Rarity = z.infer<typeof raritySchema>
export type Category = z.infer<typeof categorySchema>
export type CardPhoto = z.infer<typeof photoSchema>
export type TextLayer = z.infer<typeof textLayerSchema>
export type ImageLayer = z.infer<typeof imageLayerSchema>
export type ShapeLayer = z.infer<typeof shapeLayerSchema>
export type Layer = z.infer<typeof layerSchema>
export type LayerType = Layer['type']
export type CardSource = z.infer<typeof cardSourceSchema>
export type Card = z.infer<typeof cardSchema>
export type CardPack = z.infer<typeof cardPackSchema>
