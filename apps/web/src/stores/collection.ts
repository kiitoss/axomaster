import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type {
  Boosters,
  Catalogue,
  CatalogueEntry,
  OpenBoosterResponse,
  OwnedCard,
} from '@axomaster/card-model'
import { get, post } from '@/api/client'
import { useCardsStore } from './cards'

/** Collection du joueur connecté : catalogue (face cachée ou non) et boosters. */
export const useCollectionStore = defineStore('collection', () => {
  const cardsStore = useCardsStore()

  const entries = ref<CatalogueEntry[]>([])
  const boosters = ref<Boosters | null>(null)
  const loaded = ref(false)

  const owned = computed(() =>
    entries.value.filter((e): e is Extract<CatalogueEntry, { owned: true }> => e.owned),
  )

  /** Cartes possédées, au format attendu par les échanges. */
  const inventory = computed<OwnedCard[]>(() =>
    owned.value.map((e) => ({ card: e.card, quantity: e.quantity })),
  )

  async function loadCatalogue() {
    const catalogue = await get<Catalogue>('catalogue')
    cardsStore.categories = catalogue.categories
    entries.value = catalogue.entries
    loaded.value = true
  }

  async function loadBoosters() {
    boosters.value = await get<Boosters>('boosters')
  }

  async function openBooster(pool: string) {
    const result = await post<OpenBoosterResponse>('boosters/open', { pool })
    if (boosters.value) boosters.value.stock = result.stock
    // Le catalogue sera rechargé à la prochaine visite.
    loaded.value = false
    return result
  }

  return { entries, owned, inventory, boosters, loaded, loadCatalogue, loadBoosters, openBooster }
})
