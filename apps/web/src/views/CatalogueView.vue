<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Gift, PenLine } from 'lucide-vue-next'
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
const categoryFilter = ref('')

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

/** L'album suit l'ordre des collections défini par l'administrateur. */
const sections = computed(() => {
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
    .map((key) => {
      const category = store.getCategory(key)
      const entries = byCategory
        .get(key)!
        .sort((a, b) => (entryNumber(a) ?? 1e9) - (entryNumber(b) ?? 1e9))
      return {
        id: key || '__none',
        category,
        total: entries.length,
        owned: entries.filter((entry) => entry.owned).length,
        tiles: entries.map((entry): Tile => ({ entry, category })),
      }
    })
})

const visibleSections = computed(() =>
  sections.value
    .filter((section) => !categoryFilter.value || categoryFilter.value === section.id)
    .map((section) => ({
      ...section,
      tiles: section.tiles.filter(({ entry }) =>
        filter.value === 'owned' ? entry.owned : filter.value === 'missing' ? !entry.owned : true,
      ),
    }))
    .filter((section) => section.tiles.length),
)

/** Cartes possédées dans l'ordre d'affichage, pour la visionneuse. */
const ownedCards = computed<Card[]>(() =>
  visibleSections.value.flatMap((section) =>
    section.tiles.flatMap(({ entry }) => (entry.owned ? [entry.card] : [])),
  ),
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
    <h1 class="visually-hidden">Catalogue</h1>
    <section v-if="total" class="collection-bar" aria-label="Votre collection">
      <div class="progress-block">
        <p class="count">
          <strong>{{ ownedCount }}</strong>
          <span>/ {{ total }} cartes découvertes</span>
          <span class="percent">{{ percent }} %</span>
        </p>
        <div
          class="progress"
          role="progressbar"
          :aria-valuenow="percent"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="Progression du catalogue"
          :title="`${copies} exemplaire${copies > 1 ? 's' : ''} au total`"
        >
          <span :style="{ width: `${percent}%` }" />
        </div>
        <p class="copies">{{ copies }} exemplaire{{ copies > 1 ? 's' : '' }}</p>
      </div>
      <div class="actions">
        <RouterLink to="/creations" class="btn btn-sm"><PenLine /> Mes créations</RouterLink>
        <RouterLink to="/boosters" class="btn btn-primary btn-sm">
          <Gift /> Ouvrir un booster
        </RouterLink>
      </div>
    </section>

    <div v-if="total" class="toolbar">
      <div class="segmented" role="group" aria-label="Filtrer les cartes">
        <button
          type="button"
          :class="{ active: filter === 'all' }"
          :aria-pressed="filter === 'all'"
          @click="filter = 'all'"
        >
          Toutes
        </button>
        <button
          type="button"
          :class="{ active: filter === 'owned' }"
          :aria-pressed="filter === 'owned'"
          @click="filter = 'owned'"
        >
          Possédées
        </button>
        <button
          type="button"
          :class="{ active: filter === 'missing' }"
          :aria-pressed="filter === 'missing'"
          @click="filter = 'missing'"
        >
          À découvrir
        </button>
      </div>
      <select
        v-if="sections.length > 1"
        v-model="categoryFilter"
        class="select"
        aria-label="Collection"
      >
        <option value="">Toutes les collections</option>
        <option v-for="section in sections" :key="section.id" :value="section.id">
          {{ section.category?.name || 'Sans collection' }}
        </option>
      </select>
    </div>

    <p v-if="loading && !total" class="muted">Chargement du catalogue…</p>

    <template v-else-if="total">
      <section
        v-for="section in visibleSections"
        :key="section.id"
        class="album-section"
        :aria-label="section.category?.name || 'Sans collection'"
      >
        <header class="section-head">
          <h2>
            <span
              class="category-dot"
              :style="{ background: section.category?.color || 'var(--accent)' }"
              aria-hidden="true"
            />{{ section.category?.name || 'Sans collection' }}
          </h2>
          <span class="section-count">{{ section.owned }} / {{ section.total }}</span>
          <div class="section-progress" aria-hidden="true">
            <span :style="{ width: `${(section.owned / section.total) * 100}%` }" />
          </div>
        </header>
        <div class="grid">
          <button
            v-for="{ entry, category } in section.tiles"
            :key="entryId(entry)"
            type="button"
            class="cell"
            :class="{ owned: entry.owned }"
            :aria-label="
              entry.owned
                ? `Voir ${entry.card.name || 'la carte'}`
                : `Carte ${entryNumber(entry) ?? ''} non découverte`
            "
            @click="select(entry)"
          >
            <CatalogueTile :entry="entry" :category="category" />
          </button>
        </div>
      </section>

      <p v-if="!visibleSections.length" class="empty muted">
        {{
          filter === 'owned'
            ? 'Aucune carte possédée dans cette sélection.'
            : 'Toutes les cartes de cette sélection sont découvertes !'
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

.collection-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--shell-line);
  border-radius: var(--radius-lg);
  background: var(--shell);
  color: var(--shell-ink);
  margin-bottom: var(--space-5);
}

.progress-block {
  flex: 1;
  max-width: 440px;
  min-width: 220px;
}

.count {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--shell-muted);
  font-variant-numeric: tabular-nums;
}

.count strong {
  font: 700 36px / 1 var(--font-display);
  letter-spacing: -0.02em;
  color: var(--shell-ink);
}

.percent {
  margin-left: auto;
  font-weight: 600;
  color: var(--shell-accent);
}

.progress {
  height: 5px;
  margin-top: var(--space-2);
  border-radius: 4px;
  background: var(--shell-line);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--shell-accent);
  transition: width 0.6s ease;
}

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.collection-bar .btn {
  text-decoration: none;
  height: 38px;
  background: var(--shell-active);
  border-color: var(--shell-line);
  color: var(--shell-ink);
}

.collection-bar .btn:hover {
  border-color: var(--shell-accent);
}

.collection-bar .btn-primary {
  background: var(--shell-accent);
  border-color: var(--shell-accent);
  color: var(--shell);
}

.copies {
  margin-top: 8px;
  color: var(--shell-muted);
  font-size: 11px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.toolbar .select {
  width: auto;
  min-width: 210px;
}

.segmented button {
  height: 32px;
  padding-inline: var(--space-4);
}

.album-section {
  margin-bottom: var(--space-5);
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--album);
}

.section-head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}

.section-head h2 {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  font-size: 15px;
  font-weight: 600;
}

.category-dot {
  width: 9px;
  height: 9px;
  flex: none;
  border-radius: 3px;
}

.section-count {
  margin-left: auto;
  color: var(--ink-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.section-progress {
  width: 72px;
  height: 4px;
  border-radius: 2px;
  background: var(--paper-3);
  overflow: hidden;
}

.section-progress span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
}

.segmented button {
  white-space: nowrap;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: var(--space-5);
}

.cell {
  padding: 0;
  border: 0;
  background: none;
  border-radius: 12px;
  cursor: default;
  min-width: 0;
  text-align: left;
  font: inherit;
  color: inherit;
}

.cell.owned {
  cursor: zoom-in;
}

@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  .cell.owned {
    transition: transform 0.2s;
  }

  .cell.owned:hover {
    transform: translateY(-4px);
  }
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-5);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--paper-2);
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

  .progress-block {
    flex: 1 1 100%;
    max-width: none;
  }

  .collection-bar {
    padding: var(--space-4);
    gap: var(--space-3);
  }

  .collection-bar .actions {
    display: none;
  }

  .toolbar .segmented,
  .toolbar .select {
    flex: 1 1 100%;
    min-width: 0;
  }

  .segmented button {
    padding-inline: var(--space-2);
    min-height: 36px;
  }

  .album-section {
    padding: var(--space-4) var(--space-3);
  }

  .section-head {
    gap: var(--space-2);
    margin-bottom: var(--space-4);
  }

  .section-progress {
    width: 40px;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4) var(--space-3);
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress span {
    transition: none;
  }
}

@media (min-width: 600px) and (max-width: 860px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
