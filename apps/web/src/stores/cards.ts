import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import {
  cardImageIds,
  createPack,
  newId,
  nowIso,
  type AdminCard,
  type Card,
  type CardPack,
  type CardStatus,
  type Category,
} from '@axomaster/card-model'
import { del, get, post, put } from '@/api/client'
import { getImageDataUrl, putImageDataUrl } from '@/storage/imageStore'
import { clone } from '@/lib/clone'
import { useAuthStore } from './auth'

export type DuplicateStrategy = 'skip' | 'replace' | 'copy'

export interface ImportReport {
  added: number
  replaced: number
  skipped: number
}

/**
 * Cartes et catégories. Les catégories servent à tout le monde (rendu des cartes) ; les cartes
 * complètes, brouillons compris, ne sont chargées que pour l'administration.
 */
export const useCardsStore = defineStore('cards', () => {
  const auth = useAuthStore()

  const cards = ref<Card[]>([])
  const statuses = ref<Record<string, CardStatus>>({})
  const categories = ref<Category[]>([])
  let categoriesLoaded: Promise<void> | null = null
  let cardsLoaded: Promise<void> | null = null

  const authorName = computed(() => auth.user?.displayName ?? 'Anonyme')

  /** Auteurs distincts des cartes, pour le filtre de provenance. */
  const authors = computed(() =>
    [...new Set(cards.value.map((c) => c.author.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
  )

  function ensureCategories(force = false) {
    if (!categoriesLoaded || force) {
      categoriesLoaded = get<Category[]>('categories').then((list) => {
        categories.value = list
      })
      categoriesLoaded.catch(() => (categoriesLoaded = null))
    }
    return categoriesLoaded
  }

  function ensureAdminCards(force = false) {
    if (!cardsLoaded || force) {
      cardsLoaded = get<AdminCard[]>('admin/cards').then((list) => {
        cards.value = list.map((entry) => entry.card)
        statuses.value = Object.fromEntries(list.map((entry) => [entry.card.id, entry.status]))
      })
      cardsLoaded.catch(() => (cardsLoaded = null))
    }
    return Promise.all([cardsLoaded, ensureCategories(force)])
  }

  function getCard(id: string) {
    return cards.value.find((c) => c.id === id)
  }

  function getCategory(id: string | null | undefined) {
    return id ? (categories.value.find((c) => c.id === id) ?? null) : null
  }

  function statusOf(id: string): CardStatus {
    return statuses.value[id] ?? 'draft'
  }

  function storeLocally(entry: AdminCard) {
    const index = cards.value.findIndex((c) => c.id === entry.card.id)
    if (index === -1) cards.value.unshift(entry.card)
    else cards.value[index] = entry.card
    statuses.value[entry.card.id] = entry.status
  }

  async function saveCard(card: Card) {
    const next = clone({ ...card, updatedAt: nowIso() })
    const saved = await put<AdminCard>(`admin/cards/${encodeURIComponent(next.id)}`, next)
    storeLocally(saved)
    return saved.card
  }

  async function removeCard(id: string) {
    await del(`admin/cards/${encodeURIComponent(id)}`)
    cards.value = cards.value.filter((c) => c.id !== id)
    delete statuses.value[id]
    await collectGarbage()
  }

  async function duplicateCard(id: string) {
    const source = getCard(id)
    if (!source) return null
    const now = nowIso()
    const copy: Card = {
      ...clone(source),
      id: newId(),
      name: `${source.name} (copie)`.trim(),
      author: authorName.value,
      source: { kind: 'local' },
      createdAt: now,
      updatedAt: now,
    }
    copy.layers.forEach((l) => (l.id = newId()))
    return saveCard(copy)
  }

  async function setStatus(ids: string[], status: CardStatus) {
    if (!ids.length) return
    await post('admin/cards/status', { ids, status })
    for (const id of ids) statuses.value[id] = status
  }

  function nextNumber(categoryId: string | null) {
    const numbers = cards.value
      .filter((c) => c.categoryId === categoryId && c.number != null)
      .map((c) => c.number!)
    return numbers.length ? Math.max(...numbers) + 1 : 1
  }

  async function addCategory(name: string, color: string) {
    const category = await post<Category>('admin/categories', { name, color })
    categories.value.push(category)
    return category
  }

  async function updateCategory(category: Category) {
    await put(`admin/categories/${encodeURIComponent(category.id)}`, {
      name: category.name.trim() || 'Sans nom',
      color: category.color,
    })
  }

  async function removeCategory(id: string) {
    await del(`admin/categories/${encodeURIComponent(id)}`)
    categories.value = categories.value.filter((c) => c.id !== id)
    cards.value.forEach((c) => {
      if (c.categoryId === id) c.categoryId = null
    })
  }

  async function exportPack(list: Card[]): Promise<CardPack> {
    const imageIds = new Set(list.flatMap(cardImageIds))
    const images: Record<string, string> = {}
    for (const id of imageIds) {
      const dataUrl = await getImageDataUrl(id)
      if (dataUrl) images[id] = dataUrl
    }
    const usedCategories = new Set(list.map((c) => c.categoryId))
    return createPack({
      author: authorName.value,
      cards: clone(list),
      categories: clone(categories.value.filter((c) => usedCategories.has(c.id))),
      images,
    })
  }

  /** Nombre de cartes du paquet déjà présentes dans la galerie. */
  function countDuplicates(pack: CardPack) {
    const ids = new Set(cards.value.map((c) => c.id))
    return pack.cards.filter((c) => ids.has(c.id)).length
  }

  /** Importe un paquet : les nouvelles cartes arrivent en brouillon. */
  async function importPack(pack: CardPack, strategy: DuplicateStrategy): Promise<ImportReport> {
    for (const [id, dataUrl] of Object.entries(pack.images)) {
      await putImageDataUrl(id, dataUrl)
    }

    const report: ImportReport = { added: 0, replaced: 0, skipped: 0 }
    const importedAt = nowIso()
    const existing = new Set(cards.value.map((c) => c.id))
    const toSave: Card[] = []
    for (const incoming of pack.cards) {
      const card = clone(incoming)
      // On conserve la provenance d'origine d'une carte re-partagée.
      if (card.source.kind === 'local') {
        card.source = { kind: 'imported', from: pack.author, importedAt }
      }
      if (!existing.has(card.id)) {
        report.added++
      } else if (strategy === 'replace') {
        report.replaced++
      } else if (strategy === 'copy') {
        card.id = newId()
        card.layers.forEach((l) => (l.id = newId()))
        report.added++
      } else {
        report.skipped++
        continue
      }
      toSave.push(card)
    }

    await post('admin/import', {
      categories: pack.categories.filter((c) => !getCategory(c.id)),
      cards: toSave,
    })
    await ensureAdminCards(true)
    return report
  }

  /** Demande au serveur de supprimer les images qui ne sont plus référencées. */
  async function collectGarbage() {
    try {
      await post('admin/images/gc')
    } catch (err) {
      console.warn('Nettoyage des images impossible', err)
    }
  }

  return {
    cards,
    statuses,
    categories,
    authorName,
    authors,
    ensureCategories,
    ensureAdminCards,
    getCard,
    getCategory,
    statusOf,
    saveCard,
    removeCard,
    duplicateCard,
    setStatus,
    nextNumber,
    addCategory,
    updateCategory,
    removeCategory,
    exportPack,
    countDuplicates,
    importPack,
    collectGarbage,
  }
})
