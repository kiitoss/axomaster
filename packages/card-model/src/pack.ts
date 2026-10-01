import { cardPackSchema, PACK_FORMAT, PACK_VERSION } from './schema'
import type { Card, CardPack, Category } from './types'
import { nowIso } from './defaults'

export function createPack(input: {
  author: string
  cards: Card[]
  categories: Category[]
  images: Record<string, string>
}): CardPack {
  return {
    format: PACK_FORMAT,
    version: PACK_VERSION,
    exportedAt: nowIso(),
    author: input.author,
    categories: input.categories,
    cards: input.cards,
    images: input.images,
  }
}

type Migration = (pack: Record<string, unknown>) => Record<string, unknown>

/**
 * Migrations successives : `migrations[n]` transforme un paquet v`n` en v`n + 1`.
 * Exemple pour une future v2 : `1: (p) => ({ ...p, version: 2, cards: ... })`.
 */
const migrations: Record<number, Migration> = {}

export type ParsePackResult = { ok: true; pack: CardPack } | { ok: false; error: string }

export function parsePack(input: unknown): ParsePackResult {
  let data: unknown = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch {
      return { ok: false, error: "Le fichier n'est pas un JSON valide." }
    }
  }

  if (!data || typeof data !== 'object' || (data as { format?: unknown }).format !== PACK_FORMAT) {
    return { ok: false, error: "Ce fichier n'est pas un paquet de cartes AxoMaster." }
  }

  let pack = data as Record<string, unknown>
  let version = typeof pack.version === 'number' ? pack.version : NaN
  if (!Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'Version de paquet inconnue.' }
  }
  if (version > PACK_VERSION) {
    return {
      ok: false,
      error: `Ce paquet a été créé avec une version plus récente d'AxoMaster (v${version}).`,
    }
  }
  while (version < PACK_VERSION) {
    const migrate = migrations[version]
    if (!migrate) return { ok: false, error: `Aucune migration depuis la version ${version}.` }
    pack = migrate(pack)
    version++
  }

  const result = cardPackSchema.safeParse(pack)
  if (!result.success) {
    const issue = result.error.issues[0]
    const where = issue?.path.length ? ` (${issue.path.join('.')})` : ''
    return { ok: false, error: `Paquet invalide${where} : ${issue?.message ?? 'erreur inconnue'}` }
  }
  return { ok: true, pack: result.data }
}
