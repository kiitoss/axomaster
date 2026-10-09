<!-- Tableau joueurs × cartes (admin) : qui possède quoi, avec totaux par joueur et par carte. -->
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { formatNumber, type AdminUser, type Card, type OwnershipEntry } from '@axomaster/card-model'
import { get, errorMessage } from '@/api/client'
import { useCardsStore } from '@/stores/cards'
import CardViewer from '@/components/gallery/CardViewer.vue'
import CardMatrix from './CardMatrix.vue'
import type { MatrixColumn, MatrixRow } from './matrix'

const props = defineProps<{ users: AdminUser[] }>()
const emit = defineEmits<{ view: [user: AdminUser] }>()

const store = useCardsStore()
const entries = ref<OwnershipEntry[]>([])
const loading = ref(true)
const error = ref('')

onMounted(async () => {
  try {
    const [list] = await Promise.all([
      get<OwnershipEntry[]>('admin/ownership'),
      store.ensureAdminCards(),
    ])
    entries.value = list
  } catch (err) {
    error.value = errorMessage(err)
  } finally {
    loading.value = false
  }
})

/** Quantités par joueur puis par carte. */
const owned = computed(() => {
  const map = new Map<string, Map<string, number>>()
  for (const e of entries.value) {
    let row = map.get(e.userId)
    if (!row) map.set(e.userId, (row = new Map()))
    row.set(e.cardId, e.quantity)
  }
  return map
})

/** Cartes publiées, plus les brouillons encore possédés par quelqu'un. Ordre du catalogue. */
const cards = computed<Card[]>(() => {
  const held = new Set(entries.value.map((e) => e.cardId))
  const order = new Map(store.categories.map((c, i) => [c.id, i]))
  return store.cards
    .filter((card) => store.statusOf(card.id) === 'published' || held.has(card.id))
    .sort(
      (a, b) =>
        (order.get(a.categoryId ?? '') ?? 1e9) - (order.get(b.categoryId ?? '') ?? 1e9) ||
        (a.number ?? 1e9) - (b.number ?? 1e9),
    )
})

type Sort = 'name' | 'total'
const sort = ref<Sort>('total')

const label = (card: Card) =>
  `${card.number != null ? `N° ${formatNumber(card.number)} · ` : ''}${card.name || 'Sans nom'}${
    store.statusOf(card.id) === 'published' ? '' : ' (brouillon)'
  }`

const columns = computed<MatrixColumn[]>(() =>
  cards.value.map((card, i) => ({
    id: card.id,
    card,
    label: label(card),
    number: card.number,
    dim: store.statusOf(card.id) !== 'published',
    groupStart: i > 0 && cards.value[i - 1]!.categoryId !== card.categoryId,
  })),
)

const rows = computed<MatrixRow[]>(() => {
  const list = props.users.map((user): MatrixRow => {
    const quantities = owned.value.get(user.id) ?? new Map<string, number>()
    return {
      id: user.id,
      name: user.displayName,
      total: cards.value.filter((card) => quantities.has(card.id)).length,
      disabled: user.disabled,
      quantities,
    }
  })
  if (sort.value === 'total') list.sort((a, b) => b.total - a.total)
  return list
})

const columnTotals = computed(() =>
  cards.value.map((card) => props.users.filter((u) => owned.value.get(u.id)?.has(card.id)).length),
)

const viewer = ref<{ index: number } | null>(null)

function viewUser(id: string) {
  const user = props.users.find((u) => u.id === id)
  if (user) emit('view', user)
}
</script>

<template>
  <section class="matrix">
    <div class="segmented sort" role="group" aria-label="Trier les joueurs">
      <button type="button" :class="{ active: sort === 'total' }" @click="sort = 'total'">
        Par nombre de cartes
      </button>
      <button type="button" :class="{ active: sort === 'name' }" @click="sort = 'name'">
        Par nom
      </button>
    </div>

    <p v-if="loading" class="muted">Chargement…</p>
    <p v-else-if="error" class="error">{{ error }}</p>
    <p v-else-if="!cards.length" class="muted">Aucune carte publiée.</p>

    <CardMatrix
      v-else
      :columns="columns"
      :rows="rows"
      :footer="columnTotals"
      player-link
      @card="(id) => (viewer = { index: cards.findIndex((c) => c.id === id) })"
      @player="viewUser"
    />

    <CardViewer
      v-if="viewer"
      v-model:index="viewer.index"
      :cards="cards"
      readonly
      @close="viewer = null"
    />
  </section>
</template>

<style scoped>
.sort {
  margin-bottom: var(--space-3);
}

.sort button {
  white-space: nowrap;
}

.error {
  color: var(--danger);
}
</style>
