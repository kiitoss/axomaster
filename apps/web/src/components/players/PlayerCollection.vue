<!-- Collection d'un joueur vue par l'admin : cartes débloquées et cartes manquantes. -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AdminUser, Card, PlayerCard } from '@axomaster/card-model'
import { get, errorMessage } from '@/api/client'
import { useCardsStore } from '@/stores/cards'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import CardView from '@/components/card/CardView.vue'

const props = defineProps<{ user: AdminUser | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useCardsStore()
const inventory = ref(new Map<string, PlayerCard>())
const loading = ref(false)
const error = ref('')

type Filter = 'all' | 'owned' | 'missing'
const filter = ref<Filter>('all')

watch(
  () => props.user?.id,
  async (id) => {
    if (!id) return
    loading.value = true
    error.value = ''
    filter.value = 'all'
    try {
      const [list] = await Promise.all([
        get<PlayerCard[]>(`admin/users/${encodeURIComponent(id)}/cards`),
        store.ensureAdminCards(),
      ])
      inventory.value = new Map(list.map((entry) => [entry.cardId, entry]))
    } catch (err) {
      error.value = errorMessage(err)
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

/**
 * Cartes publiées (celles qu'un joueur peut obtenir), plus les brouillons qu'il possède encore.
 * Ordre du catalogue : collection, puis numéro.
 */
const cards = computed<Card[]>(() => {
  const order = new Map(store.categories.map((c, i) => [c.id, i]))
  return store.cards
    .filter((card) => store.statusOf(card.id) === 'published' || inventory.value.has(card.id))
    .sort(
      (a, b) =>
        (order.get(a.categoryId ?? '') ?? 1e9) - (order.get(b.categoryId ?? '') ?? 1e9) ||
        (a.number ?? 1e9) - (b.number ?? 1e9),
    )
})

const ownedCount = computed(() => cards.value.filter((c) => inventory.value.has(c.id)).length)
const percent = computed(() =>
  cards.value.length ? Math.round((ownedCount.value / cards.value.length) * 100) : 0,
)

const visible = computed(() =>
  cards.value.filter((card) => {
    const owned = inventory.value.has(card.id)
    return filter.value === 'owned' ? owned : filter.value === 'missing' ? !owned : true
  }),
)

function obtainedOn(card: Card) {
  const entry = inventory.value.get(card.id)
  return entry ? new Date(entry.firstObtainedAt).toLocaleDateString('fr-FR') : ''
}
</script>

<template>
  <BaseDialog
    :open="!!user"
    :title="user ? `Collection de ${user.displayName}` : ''"
    width="980px"
    @close="emit('close')"
  >
    <p v-if="error" class="error">{{ error }}</p>
    <p v-else-if="loading" class="muted">Chargement…</p>

    <template v-else>
      <div class="toolbar">
        <div class="progress-block">
          <p class="count">
            <strong>{{ ownedCount }}</strong> / {{ cards.length }} carte{{
              cards.length > 1 ? 's' : ''
            }}
            <span class="percent">{{ percent }} %</span>
          </p>
          <div class="progress" role="progressbar" :aria-valuenow="percent">
            <span :style="{ width: `${percent}%` }" />
          </div>
        </div>
        <div class="segmented" role="group" aria-label="Filtrer les cartes">
          <button type="button" :class="{ active: filter === 'all' }" @click="filter = 'all'">
            Toutes
          </button>
          <button type="button" :class="{ active: filter === 'owned' }" @click="filter = 'owned'">
            Débloquées
          </button>
          <button
            type="button"
            :class="{ active: filter === 'missing' }"
            @click="filter = 'missing'"
          >
            Manquantes
          </button>
        </div>
      </div>

      <div v-if="visible.length" class="grid">
        <figure
          v-for="card in visible"
          :key="card.id"
          class="tile"
          :class="{ missing: !inventory.has(card.id) }"
          :title="
            inventory.has(card.id)
              ? `Obtenue le ${obtainedOn(card)}`
              : 'Pas encore débloquée par ce joueur'
          "
        >
          <CardView :card="card" :category="store.getCategory(card.categoryId)" />
          <span v-if="(inventory.get(card.id)?.quantity ?? 0) > 1" class="quantity">
            ×{{ inventory.get(card.id)?.quantity }}
          </span>
          <figcaption>
            <span class="name">{{ card.name || 'Sans nom' }}</span>
            <span class="muted">
              {{ inventory.has(card.id) ? obtainedOn(card) : 'Manquante' }}
            </span>
          </figcaption>
        </figure>
      </div>
      <p v-else class="muted empty">
        {{
          filter === 'owned' ? 'Aucune carte débloquée pour l’instant.' : 'Aucune carte manquante.'
        }}
      </p>
    </template>
  </BaseDialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}

.progress-block {
  flex: 1;
  max-width: 360px;
  min-width: 200px;
}

.count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.count strong {
  font: 700 22px / 1 var(--font-display);
  color: var(--ink);
}

.percent {
  margin-left: auto;
  font-weight: 600;
  color: var(--accent);
}

.progress {
  height: 6px;
  margin-top: var(--space-2);
  border-radius: 3px;
  background: var(--paper-3);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #a78bfa, #7c3aed);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: var(--space-4) var(--space-3);
}

.tile {
  position: relative;
  margin: 0;
}

/* Carte manquante : visible pour l'admin, mais nettement éteinte. */
.tile.missing :deep(.card) {
  opacity: 0.35;
  filter: grayscale(1);
}

.quantity {
  position: absolute;
  top: -6px;
  right: -6px;
  padding: 1px 7px;
  border-radius: 10px;
  background: var(--accent-strong);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
}

figcaption {
  display: flex;
  flex-direction: column;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.3;
}

.name {
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tile.missing .name {
  color: var(--ink-3);
}

.empty {
  padding: var(--space-6) 0;
  text-align: center;
}

.error {
  color: var(--danger);
}

@media (max-width: 860px) {
  .progress-block,
  .segmented {
    flex: 1 1 100%;
    max-width: none;
  }

  .grid {
    grid-template-columns: repeat(3, 1fr);
    gap: var(--space-3) var(--space-2);
  }
}
</style>
