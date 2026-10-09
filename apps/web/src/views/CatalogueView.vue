<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Gift } from 'lucide-vue-next'
import type { Card, CatalogueEntry, Category } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useCollectionStore } from '@/stores/collection'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import CatalogueTile from '@/components/catalogue/CatalogueTile.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'

const store = useCardsStore()
const collection = useCollectionStore()
const toast = useToast()
const version = import.meta.env.VITE_APP_VERSION || 'dev'

const loading = ref(!collection.loaded)

onMounted(async () => {
  try {
    await collection.loadCatalogue()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loading.value = false
  }
})

type Filter = 'all' | 'owned' | 'missing'
const filter = ref<Filter>('all')

const total = computed(() => collection.entries.length)
const ownedCount = computed(() => collection.owned.length)
const copies = computed(() => collection.owned.reduce((sum, e) => sum + e.quantity, 0))
const percent = computed(() =>
  total.value ? Math.round((ownedCount.value / total.value) * 100) : 0,
)

const entryId = (e: CatalogueEntry) => (e.owned ? e.card.id : e.id)
const entryNumber = (e: CatalogueEntry) => (e.owned ? e.card.number : e.number)
const entryCategory = (e: CatalogueEntry) => (e.owned ? e.card.categoryId : e.categoryId)

interface Tile {
  entry: CatalogueEntry
  category: Category | null
}

/**
 * Une seule grille : les cartes restent regroupées par collection (dans l'ordre défini par
 * l'admin, puis les cartes sans collection), triées par numéro, sans séparation visuelle.
 */
const tiles = computed<Tile[]>(() => {
  const byCategory = new Map<string, CatalogueEntry[]>()
  for (const entry of collection.entries) {
    const key = entryCategory(entry) ?? ''
    const list = byCategory.get(key)
    if (list) list.push(entry)
    else byCategory.set(key, [entry])
  }
  const order = [...store.categories.map((c) => c.id), '']
  for (const key of byCategory.keys()) if (!order.includes(key)) order.push(key)

  return order
    .filter((key) => byCategory.has(key))
    .flatMap((key) => {
      const category = store.getCategory(key)
      return byCategory
        .get(key)!
        .sort((a, b) => (entryNumber(a) ?? 1e9) - (entryNumber(b) ?? 1e9))
        .filter((e) =>
          filter.value === 'owned' ? e.owned : filter.value === 'missing' ? !e.owned : true,
        )
        .map((entry) => ({ entry, category }))
    })
})

/** Cartes possédées dans l'ordre d'affichage, pour la visionneuse. */
const ownedCards = computed<Card[]>(() =>
  tiles.value.flatMap(({ entry }) => (entry.owned ? [entry.card] : [])),
)
const quantities = computed(() =>
  Object.fromEntries(collection.owned.map((e) => [e.card.id, e.quantity])),
)
const viewerIndex = ref<number | null>(null)

function select(entry: CatalogueEntry) {
  if (!entry.owned) {
    toast.show('Carte encore cachée : trouvez-la dans un booster ou par un échange.')
    return
  }
  viewerIndex.value = ownedCards.value.findIndex((c) => c.id === entry.card.id)
}
</script>

<template>
  <div class="catalogue">
    <section v-if="total" class="toolbar">
      <div class="progress-block">
        <p class="count">
          <strong>{{ ownedCount }}</strong> / {{ total }} carte{{ total > 1 ? 's' : '' }}
          <span class="percent">{{ percent }} %</span>
        </p>
        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          :title="`${copies} exemplaire${copies > 1 ? 's' : ''} au total`"
        >
          <span :style="{ width: `${percent}%` }" />
        </div>
      </div>
      <div class="actions">
        <div class="segmented" role="group" aria-label="Filtrer les cartes">
          <button type="button" :class="{ active: filter === 'all' }" @click="filter = 'all'">
            Toutes
          </button>
          <button type="button" :class="{ active: filter === 'owned' }" @click="filter = 'owned'">
            Possédées
          </button>
          <button
            type="button"
            :class="{ active: filter === 'missing' }"
            @click="filter = 'missing'"
          >
            À découvrir
          </button>
        </div>
        <RouterLink to="/boosters" class="btn btn-primary btn-sm">
          <Gift /> Ouvrir un booster
        </RouterLink>
      </div>
    </section>

    <p v-if="loading && !total" class="muted">Chargement du catalogue…</p>

    <template v-else-if="total">
      <section v-if="tiles.length" class="grid">
        <button
          v-for="{ entry, category } in tiles"
          :key="entryId(entry)"
          type="button"
          class="cell"
          :class="{ owned: entry.owned }"
          :aria-label="
            entry.owned ? `Voir ${entry.card.name || 'la carte'}` : 'Carte non découverte'
          "
          @click="select(entry)"
        >
          <CatalogueTile :entry="entry" :category="category" />
        </button>
      </section>

      <p v-else class="empty muted">
        {{
          filter === 'owned' ? 'Vous n’avez encore aucune carte.' : 'Vous avez toutes les cartes !'
        }}
      </p>
    </template>

    <section v-else class="empty">
      <h2>Le catalogue est vide</h2>
      <p class="muted">Aucune carte n’est encore en jeu. Revenez bientôt !</p>
    </section>

    <p class="version muted">AxoMaster · {{ version }}</p>

    <CardViewer
      v-if="viewerIndex !== null && ownedCards.length"
      v-model:index="viewerIndex"
      :cards="ownedCards"
      :quantities="quantities"
      readonly
      @close="viewerIndex = null"
    />
  </div>
</template>

<style scoped>
.catalogue {
  max-width: 1320px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-6) var(--space-7);
}

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
  max-width: 420px;
  min-width: 220px;
}

.count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--ink-3);
  font-variant-numeric: tabular-nums;
}

.count strong {
  font: 700 26px / 1 var(--font-display);
  letter-spacing: -0.02em;
  color: var(--ink);
}

.percent {
  margin-left: auto;
  font-weight: 600;
  color: var(--accent);
}

.progress {
  height: 8px;
  margin-top: var(--space-2);
  border-radius: 4px;
  background: var(--paper-3);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #a78bfa, #7c3aed);
  transition: width 0.6s ease;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.toolbar .btn {
  text-decoration: none;
}

.segmented button {
  white-space: nowrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-5) var(--space-4);
}

.cell {
  padding: 0;
  border: 0;
  background: none;
  border-radius: 12px;
  cursor: default;
}

.cell.owned {
  cursor: zoom-in;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) 0;
  text-align: center;
}

.empty h2 {
  font-size: 30px;
  font-weight: 500;
}

.version {
  margin-top: var(--space-7);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-align: center;
}

@media (max-width: 860px) {
  .catalogue {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .progress-block,
  .actions {
    flex: 1 1 100%;
    max-width: none;
  }

  .actions .segmented {
    flex: 1;
  }

  .toolbar .btn {
    display: none;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4) var(--space-3);
  }
}

@media (min-width: 600px) and (max-width: 860px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
