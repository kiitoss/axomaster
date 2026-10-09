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
import type {
  adminCardSchema,
  adminUserSchema,
  boosterSettingsSchema,
  boosterStockSchema,
  boostersSchema,
  cardStatusSchema,
  catalogueEntrySchema,
  catalogueSchema,
  createTradeRequestSchema,
  createUserRequestSchema,
  giftBoostersRequestSchema,
  leaderboardSchema,
  openBoosterResponseSchema,
  ownedCardSchema,
  ownershipEntrySchema,
  playerCardSchema,
  playerSchema,
  pushConfigSchema,
  pushSubscriptionSchema,
  roleSchema,
  sessionUserSchema,
  sharedCardSchema,
  tradeSchema,
  tradeStatusSchema,
  updateUserRequestSchema,
} from './api'

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

// ---------- API ----------

export type Role = z.infer<typeof roleSchema>
export type SessionUser = z.infer<typeof sessionUserSchema>
export type Player = z.infer<typeof playerSchema>
export type AdminUser = z.infer<typeof adminUserSchema>
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>
export type CardStatus = z.infer<typeof cardStatusSchema>
export type AdminCard = z.infer<typeof adminCardSchema>
export type OwnedCard = z.infer<typeof ownedCardSchema>
export type SharedCard = z.infer<typeof sharedCardSchema>
export type CatalogueEntry = z.infer<typeof catalogueEntrySchema>
export type Catalogue = z.infer<typeof catalogueSchema>
export type PlayerCard = z.infer<typeof playerCardSchema>
export type OwnershipEntry = z.infer<typeof ownershipEntrySchema>
export type Leaderboard = z.infer<typeof leaderboardSchema>
export type BoosterSettings = z.infer<typeof boosterSettingsSchema>
export type BoosterStockInfo = z.infer<typeof boosterStockSchema>
export type Boosters = z.infer<typeof boostersSchema>
export type OpenBoosterResponse = z.infer<typeof openBoosterResponseSchema>
export type TradeStatus = z.infer<typeof tradeStatusSchema>
export type Trade = z.infer<typeof tradeSchema>
export type CreateTradeRequest = z.input<typeof createTradeRequestSchema>
export type GiftBoostersRequest = z.input<typeof giftBoostersRequestSchema>
export type PushConfig = z.infer<typeof pushConfigSchema>
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>
