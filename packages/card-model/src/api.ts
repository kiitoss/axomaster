import { z } from 'zod'
import { cardSchema, categorySchema } from './schema'

/**
 * Contrats de l'API HTTP (`/api/*`), partagés par le Worker et le front.
 * Les types correspondants sont dérivés dans `types.ts`.
 */

const id = z.string().min(1).max(100)
const isoDate = z.string().max(40)

// ---------- Utilisateurs et authentification ----------

export const ROLES = ['admin', 'player'] as const
export const roleSchema = z.enum(ROLES)

export const usernameSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9._-]+$/i, 'Lettres, chiffres, point, tiret ou soulignement uniquement')

export const passwordSchema = z.string().min(8, 'Au moins 8 caractères').max(200)

export const sessionUserSchema = z.object({
  id,
  username: z.string(),
  displayName: z.string(),
  role: roleSchema,
})

export const loginRequestSchema = z.object({
  username: z.string().trim().min(1).max(40),
  password: z.string().min(1).max(200),
})

/** Joueur tel que les autres le voient (choix d'un partenaire d'échange). */
export const playerSchema = z.object({ id, displayName: z.string() })

export const adminUserSchema = sessionUserSchema.extend({
  disabled: z.boolean(),
  createdAt: isoDate,
  bonusBoosters: z.number().int(),
  distinctCards: z.number().int(),
  totalCards: z.number().int(),
})

export const createUserRequestSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80),
  password: passwordSchema,
  role: roleSchema,
})

export const updateUserRequestSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  role: roleSchema.optional(),
  disabled: z.boolean().optional(),
  password: passwordSchema.optional(),
})

// ---------- Cartes (admin) ----------

export const CARD_STATUSES = ['draft', 'published'] as const
export const cardStatusSchema = z.enum(CARD_STATUSES)

export const adminCardSchema = z.object({
  card: cardSchema,
  status: cardStatusSchema,
  publishedAt: isoDate.nullable(),
})

export const importRequestSchema = z.object({
  categories: z.array(categorySchema).max(200),
  cards: z.array(cardSchema).max(2000),
})

// ---------- Catalogue et inventaire ----------

export const ownedCardSchema = z.object({
  card: cardSchema,
  quantity: z.number().int().min(1),
})

/** Une carte non possédée ne révèle que sa place dans le catalogue. */
export const catalogueEntrySchema = z.discriminatedUnion('owned', [
  ownedCardSchema.extend({ owned: z.literal(true) }),
  z.object({
    owned: z.literal(false),
    id,
    number: z.number().int().nullable(),
    categoryId: id.nullable(),
  }),
])

export const catalogueSchema = z.object({
  categories: z.array(categorySchema),
  entries: z.array(catalogueEntrySchema),
})

// ---------- Boosters ----------

export const boosterSettingsSchema = z.object({
  /** Délai de recharge d'un booster, en secondes (1 jour par défaut). */
  intervalSeconds: z
    .number()
    .int()
    .min(60)
    .max(30 * 86_400),
  /** Nombre maximal de boosters périodiques accumulés. */
  maxStock: z.number().int().min(1).max(50),
  /** Nombre de cartes par booster. */
  size: z.number().int().min(1).max(15),
})

export const boosterStockSchema = z.object({
  periodic: z.number().int(),
  bonus: z.number().int(),
  total: z.number().int(),
  nextAt: isoDate.nullable(),
})

export const BOOSTER_POOL_ALL = 'all'

export const boosterOfferSchema = z.object({
  /** `all` ou identifiant de catégorie. */
  pool: id,
  title: z.string(),
  color: z.string(),
  cardCount: z.number().int(),
})

export const boostersSchema = z.object({
  stock: boosterStockSchema,
  size: z.number().int(),
  offers: z.array(boosterOfferSchema),
})

export const openBoosterRequestSchema = z.object({ pool: id })

export const openBoosterResponseSchema = z.object({
  cards: z.array(cardSchema),
  /** Cartes que le joueur ne possédait pas avant ce booster. */
  newCardIds: z.array(id),
  stock: boosterStockSchema,
})

export const giftBoostersRequestSchema = z.object({ count: z.number().int().min(1).max(20) })

// ---------- Échanges ----------

export const TRADE_STATUSES = ['pending', 'accepted', 'declined', 'cancelled', 'failed'] as const
export const tradeStatusSchema = z.enum(TRADE_STATUSES)

export const tradeItemRequestSchema = z.object({
  cardId: id,
  quantity: z.number().int().min(1).max(99),
})

export const createTradeRequestSchema = z.object({
  toUserId: id,
  offer: z.array(tradeItemRequestSchema).max(20),
  request: z.array(tradeItemRequestSchema).max(20),
  message: z.string().trim().max(280).default(''),
})

export const tradeSchema = z.object({
  id,
  from: playerSchema,
  to: playerSchema,
  status: tradeStatusSchema,
  message: z.string(),
  createdAt: isoDate,
  resolvedAt: isoDate.nullable(),
  /** Cartes données par `from`. */
  offer: z.array(ownedCardSchema),
  /** Cartes demandées à `to`. */
  request: z.array(ownedCardSchema),
})

/** Corps d'erreur renvoyé par l'API. */
export const apiErrorSchema = z.object({ error: z.string() })
