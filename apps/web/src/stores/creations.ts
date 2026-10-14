import { ref } from 'vue'
import { defineStore } from 'pinia'
import {
  nowIso,
  type Card,
  type CreationQuotaInfo,
  type MyCreation,
  type MyCreations,
} from '@axomaster/card-model'
import { del, get, put } from '@/api/client'
import { clone } from '@/lib/clone'
import { useCardsStore } from './cards'

/**
 * Cartes proposées par le joueur connecté et son quota de créations. Le quota est affiché avant
 * d'ouvrir l'éditeur ; le serveur le revérifie au premier enregistrement.
 */
export const useCreationsStore = defineStore('creations', () => {
  const cardsStore = useCardsStore()

  const creations = ref<MyCreation[]>([])
  const quota = ref<CreationQuotaInfo | null>(null)
  const loaded = ref(false)

  async function load() {
    const [data] = await Promise.all([get<MyCreations>('creations'), cardsStore.ensureCategories()])
    creations.value = data.cards
    quota.value = data.quota
    loaded.value = true
  }

  function getCreation(id: string) {
    return creations.value.find((c) => c.card.id === id)
  }

  /** Une nouvelle carte consomme un crédit : le quota est rechargé depuis le serveur. */
  async function save(card: Card) {
    const isNew = !getCreation(card.id)
    const next = clone({ ...card, updatedAt: nowIso() })
    const saved = await put<MyCreation>(`creations/${encodeURIComponent(next.id)}`, next)
    const index = creations.value.findIndex((c) => c.card.id === saved.card.id)
    if (index === -1) creations.value.unshift(saved)
    else creations.value[index] = saved
    if (isNew) await load()
    return saved
  }

  async function remove(id: string) {
    await del(`creations/${encodeURIComponent(id)}`)
    creations.value = creations.value.filter((c) => c.card.id !== id)
  }

  return { creations, quota, loaded, load, getCreation, save, remove }
})
