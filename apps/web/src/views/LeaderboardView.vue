<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatNumber, type Card, type Leaderboard } from '@axomaster/card-model'
import { get, errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useCardsStore } from '@/stores/cards'
import { useCollectionStore } from '@/stores/collection'
import { useToast } from '@/composables/useToast'
import CardMatrix from '@/components/players/CardMatrix.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'
import type { MatrixColumn, MatrixRow } from '@/components/players/matrix'

const auth = useAuthStore()
const store = useCardsStore()
const collection = useCollectionStore()
const toast = useToast()

const board = ref<Leaderboard | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const [data] = await Promise.all([get<Leaderboard>('leaderboard'), collection.loadCatalogue()])
    board.value = data
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loading.value = false
  }
})

/** Mes cartes (contenu connu grâce au catalogue). */
const mine = computed(() => new Map(collection.owned.map((e) => [e.card.id, e.card])))

/** Colonnes dans l'ordre du catalogue : collection (ordre admin), puis numéro. */
const columns = computed<MatrixColumn[]>(() => {
  if (!board.value) return []
  const order = new Map(store.categories.map((c, i) => [c.id, i]))
  const sorted = [...board.value.cards].sort(
    (a, b) =>
      (order.get(a.categoryId ?? '') ?? 1e9) - (order.get(b.categoryId ?? '') ?? 1e9) ||
      (a.number ?? 1e9) - (b.number ?? 1e9),
  )
  return sorted.map((col, i) => {
    const card = mine.value.get(col.id)
    const number = col.number !== null ? `N° ${formatNumber(col.number)}` : 'Sans numéro'
    return {
      id: col.id,
      card,
      label: card ? card.name || number : `${number} · pas encore débloquée`,
      number: col.number,
      color: store.getCategory(col.categoryId)?.color,
      groupStart: i > 0 && sorted[i - 1]!.categoryId !== col.categoryId,
    }
  })
})

const rows = computed<MatrixRow[]>(() => {
  if (!board.value) return []
  const players = board.value.players
  return players.map((player) => ({
    id: player.id,
    name: player.displayName,
    total: player.owned.length,
    // Les ex aequo partagent le même rang.
    rank: 1 + players.filter((p) => p.owned.length > player.owned.length).length,
    me: player.id === auth.user?.id,
    quantities: new Map(player.owned.map((id) => [id, 1])),
  }))
})

/** Cartes que je peux montrer, dans l'ordre des colonnes. */
const visible = computed<Card[]>(() => columns.value.flatMap((col) => (col.card ? [col.card] : [])))

const viewer = ref<{ index: number } | null>(null)

function open(id: string) {
  const index = visible.value.findIndex((card) => card.id === id)
  if (index >= 0) viewer.value = { index }
}

const quantities = computed(() =>
  Object.fromEntries(collection.owned.map((e) => [e.card.id, e.quantity])),
)
</script>

<template>
  <div class="page">
    <p v-if="loading" class="muted">Chargement…</p>
    <CardMatrix v-else-if="rows.length" :columns="columns" :rows="rows" @card="open" />
    <p v-else class="muted">Aucun joueur pour le moment.</p>

    <CardViewer
      v-if="viewer"
      v-model:index="viewer.index"
      :cards="visible"
      :quantities="quantities"
      readonly
      @close="viewer = null"
    />
  </div>
</template>

<style scoped>
.page {
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-4) var(--space-4) var(--space-6);
  }
}
</style>
