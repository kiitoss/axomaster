import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  cardImageIds,
  createPack,
  DEFAULT_CATEGORIES,
  newId,
  nowIso,
  type Card,
  type CardPack,
  type Category,
} from '@axomaster/card-model'
import { localRepository } from '@/storage/repository'
import {
  deleteImages,
  getImageDataUrl,
  listImageIds,
  putImageDataUrl,
} from '@/storage/imageStore'
import { clone } from '@/lib/clone'

export type DuplicateStrategy = 'skip' | 'replace' | 'copy'

export interface ImportReport {
  added: number
  replaced: number
  skipped: number
}

export const useCardsStore = defineStore('cards', () => {
  const repo = localRepository
  const initial = repo.load()

  const cards = ref<Card[]>(initial.cards)
  const categories = ref<Category[]>(initial.categories ?? clone(DEFAULT_CATEGORIES))
  const author = ref(initial.author)

  watch(cards, (v) => repo.saveCards(v), { deep: true })
  watch(categories, (v) => repo.saveCategories(v), { deep: true })
  watch(author, (v) => repo.saveAuthor(v))

  const authorName = computed(() => author.value.trim() || 'Anonyme')

  /** Auteurs distincts des cartes, pour le filtre de provenance. */
  const authors = computed(() =>
    [...new Set(cards.value.map((c) => c.author.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    ),
  )

  function getCard(id: string) {
    return cards.value.find((c) => c.id === id)
  }

  function getCategory(id: string | null | undefined) {
    return id ? (categories.value.find((c) => c.id === id) ?? null) : null
  }

  function saveCard(card: Card) {
    const next = clone({ ...card, updatedAt: nowIso() })
    const index = cards.value.findIndex((c) => c.id === card.id)
    if (index === -1) cards.value.unshift(next)
    else cards.value[index] = next
    return next
  }

  async function removeCard(id: string) {
    cards.value = cards.value.filter((c) => c.id !== id)
    await collectGarbage()
  }

  function duplicateCard(id: string) {
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
    cards.value.unshift(copy)
    return copy
  }

  function nextNumber(categoryId: string | null) {
    const numbers = cards.value
      .filter((c) => c.categoryId === categoryId && c.number != null)
      .map((c) => c.number!)
    return numbers.length ? Math.max(...numbers) + 1 : 1
  }

  function addCategory(name: string, color: string) {
    const category = { id: newId(), name, color }
    categories.value.push(category)
    return category
  }

  function removeCategory(id: string) {
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

  async function importPack(pack: CardPack, strategy: DuplicateStrategy): Promise<ImportReport> {
    for (const [id, dataUrl] of Object.entries(pack.images)) {
      await putImageDataUrl(id, dataUrl)
    }

    for (const category of pack.categories) {
      if (!getCategory(category.id)) categories.value.push(clone(category))
    }

    const report: ImportReport = { added: 0, replaced: 0, skipped: 0 }
    const importedAt = nowIso()
    for (const incoming of pack.cards) {
      const card = clone(incoming)
      // On conserve la provenance d'origine d'une carte re-partagée.
      if (card.source.kind === 'local') {
        card.source = { kind: 'imported', from: pack.author, importedAt }
      }
      const index = cards.value.findIndex((c) => c.id === card.id)
      if (index === -1) {
        cards.value.unshift(card)
        report.added++
      } else if (strategy === 'replace') {
        cards.value[index] = card
        report.replaced++
      } else if (strategy === 'copy') {
        card.id = newId()
        card.layers.forEach((l) => (l.id = newId()))
        cards.value.unshift(card)
        report.added++
      } else {
        report.skipped++
      }
    }

    await collectGarbage()
    return report
  }

  /** Supprime les images qui ne sont plus référencées par aucune carte. */
  async function collectGarbage(keep: string[] = []) {
    const used = new Set([...cards.value.flatMap(cardImageIds), ...keep])
    const orphans = (await listImageIds()).filter((id) => !used.has(id))
    await deleteImages(orphans)
  }

  return {
    cards,
    categories,
    author,
    authorName,
    authors,
    getCard,
    getCategory,
    saveCard,
    removeCard,
    duplicateCard,
    nextNumber,
    addCategory,
    removeCategory,
    exportPack,
    countDuplicates,
    importPack,
    collectGarbage,
  }
})
