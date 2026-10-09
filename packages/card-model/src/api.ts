import { z } from 'zod'
import { GIFT_MESSAGE_MAX } from './notifications'
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

/** Inventaire d'un joueur vu par l'admin : uniquement les cartes possédées (quantité > 0). */
export const playerCardSchema = z.object({
  cardId: id,
  quantity: z.number().int(),
  firstObtainedAt: isoDate,
})

/** Possession d'une carte par un joueur (tableau joueurs × cartes de l'admin). */
export const ownershipEntrySchema = z.object({
  userId: id,
  cardId: id,
  quantity: z.number().int().min(1),
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

/**
 * Carte d'un autre joueur (inventaire, échange) : `card` n'est renseignée que si le joueur
 * connecté en possède lui-même un exemplaire ; sinon seule sa place dans le catalogue est révélée.
 */
export const sharedCardSchema = z.object({
  id,
  number: z.number().int().nullable(),
  categoryId: id.nullable(),
  quantity: z.number().int().min(1),
  card: cardSchema.optional(),
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

// ---------- Classement ----------

/**
 * Classement des joueurs : uniquement des identifiants de cartes publiées, jamais leur contenu.
 * Le front croise avec son propre catalogue pour savoir quelles cartes il peut montrer.
 */
export const leaderboardSchema = z.object({
  cards: z.array(z.object({ id, number: z.number().int().nullable(), categoryId: id.nullable() })),
  /** Triés par nombre de cartes débloquées décroissant, puis par nom. */
  players: z.array(playerSchema.extend({ owned: z.array(id) })),
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

/** Un booster unique, tiré parmi toutes les cartes publiées. */
export const boostersSchema = z.object({
  stock: boosterStockSchema,
  size: z.number().int(),
  /** Nombre de cartes publiées, donc pouvant sortir d'un booster. */
  cardCount: z.number().int(),
})

export const openBoosterResponseSchema = z.object({
  cards: z.array(cardSchema),
  /** Cartes que le joueur ne possédait pas avant ce booster. */
  newCardIds: z.array(id),
  stock: boosterStockSchema,
})

export const giftBoostersRequestSchema = z.object({
  count: z.number().int().min(1).max(20),
  /** Message affiché dans la notification push (texte par défaut si vide). */
  message: z.string().trim().max(GIFT_MESSAGE_MAX).default(''),
})

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
  offer: z.array(sharedCardSchema),
  /** Cartes demandées à `to`. */
  request: z.array(sharedCardSchema),
})

// ---------- Notifications push ----------

/** Clé publique VAPID ; `null` si les notifications ne sont pas configurées sur le serveur. */
export const pushConfigSchema = z.object({ publicKey: z.string().nullable() })

/** Abonnement Web Push (forme de `PushSubscription.toJSON()`). */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
})

export const pushUnsubscribeRequestSchema = z.object({ endpoint: z.string().max(1000) })

/** Corps d'erreur renvoyé par l'API. */
export const apiErrorSchema = z.object({ error: z.string() })
