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

interface Group {
  key: string
  category: Category | null
  entries: CatalogueEntry[]
  owned: number
  total: number
}

/** Une section par collection (dans l'ordre défini par l'admin), puis les cartes sans collection. */
const groups = computed<Group[]>(() => {
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
      const all = byCategory.get(key)!
      all.sort((a, b) => (entryNumber(a) ?? 1e9) - (entryNumber(b) ?? 1e9))
      const visible = all.filter((e) =>
        filter.value === 'owned' ? e.owned : filter.value === 'missing' ? !e.owned : true,
      )
      return {
        key: key || '__none',
        category: store.getCategory(key),
        entries: visible,
        owned: all.filter((e) => e.owned).length,
        total: all.length,
      }
    })
    .filter((g) => g.entries.length)
})

/** Cartes possédées dans l'ordre d'affichage, pour la visionneuse. */
const ownedCards = computed<Card[]>(() =>
  groups.value.flatMap((g) => g.entries.flatMap((e) => (e.owned ? [e.card] : []))),
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
    <section class="intro">
      <p class="eyebrow">Ma collection</p>
      <h1>Catalogue</h1>
      <p v-if="total" class="muted">
        {{ ownedCount }} carte{{ ownedCount > 1 ? 's' : '' }} découverte{{
          ownedCount > 1 ? 's' : ''
        }}
        sur {{ total }} · {{ copies }} exemplaire{{ copies > 1 ? 's' : '' }} au total.
      </p>
      <div
        v-if="total"
        class="progress"
        role="progressbar"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${percent}%` }" />
      </div>
    </section>

    <section v-if="total" class="toolbar">
      <div class="segmented" role="group" aria-label="Filtrer les cartes">
        <button type="button" :class="{ active: filter === 'all' }" @click="filter = 'all'">
          Toutes
        </button>
        <button type="button" :class="{ active: filter === 'owned' }" @click="filter = 'owned'">
          Possédées
        </button>
        <button type="button" :class="{ active: filter === 'missing' }" @click="filter = 'missing'">
          À découvrir
        </button>
      </div>
      <RouterLink to="/boosters" class="btn btn-primary btn-sm">
        <Gift /> Ouvrir un booster
      </RouterLink>
    </section>

    <p v-if="loading && !total" class="muted">Chargement du catalogue…</p>

    <template v-else-if="total">
      <section v-for="group in groups" :key="group.key" class="group">
        <header class="group-head" :style="{ '--group': group.category?.color ?? 'var(--ink-3)' }">
          <h2>{{ group.category?.name ?? 'Hors collection' }}</h2>
          <span class="muted">{{ group.owned }} / {{ group.total }}</span>
        </header>
        <div class="grid">
          <button
            v-for="entry in group.entries"
            :key="entryId(entry)"
            type="button"
            class="cell"
            :class="{ owned: entry.owned }"
            :aria-label="
              entry.owned ? `Voir ${entry.card.name || 'la carte'}` : 'Carte non découverte'
            "
            @click="select(entry)"
          >
            <CatalogueTile :entry="entry" :category="group.category" />
          </button>
        </div>
      </section>

      <p v-if="!groups.length" class="empty muted">
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
  padding: var(--space-7) var(--space-6);
}

.intro {
  margin-bottom: var(--space-5);
}

.intro h1 {
  font-size: 52px;
  line-height: 1.05;
  font-weight: 500;
}

.intro .muted {
  margin-top: var(--space-2);
}

.progress {
  max-width: 420px;
  height: 4px;
  margin-top: var(--space-3);
  border-radius: 2px;
  background: var(--paper-3);
  overflow: hidden;
}

.progress span {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.6s ease;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-6);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.toolbar .btn {
  text-decoration: none;
}

.segmented button {
  white-space: nowrap;
}

.group + .group {
  margin-top: var(--space-7);
}

.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
  padding-bottom: var(--space-2);
  border-bottom: 1px solid var(--line);
}

.group-head h2 {
  position: relative;
  padding-left: var(--space-4);
  font-size: 28px;
  font-weight: 500;
}

.group-head h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 8px;
  height: 8px;
  translate: 0 -50%;
  transform: rotate(45deg);
  background: var(--group);
}

.group-head .muted {
  font-variant-numeric: tabular-nums;
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

  .intro h1 {
    font-size: 40px;
  }

  .toolbar {
    margin-bottom: var(--space-5);
  }

  .toolbar .segmented {
    flex: 1;
  }

  .toolbar .btn {
    display: none;
  }

  .group-head h2 {
    font-size: 24px;
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
