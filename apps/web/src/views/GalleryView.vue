<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Download, Plus, Search, Sparkles, Upload } from 'lucide-vue-next'
import { RARITY_INFO, RARITY_LIST, type Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { buildSamplePack } from '@/lib/samples'
import CardView from '@/components/card/CardView.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'
import ImportDialog from '@/components/gallery/ImportDialog.vue'
import ExportDialog from '@/components/gallery/ExportDialog.vue'

const store = useCardsStore()
const router = useRouter()
const toast = useToast()

type Sort = 'recent' | 'name' | 'rarity' | 'number'

const query = ref('')
const category = ref<string>('')
const rarity = ref<string>('')
const provenance = ref<string>('')
const sort = ref<Sort>('recent')

const filtered = computed(() => {
  const q = normalize(query.value)
  const list = store.cards.filter((card) => {
    if (category.value === '__none' ? card.categoryId : category.value && card.categoryId !== category.value)
      return false
    if (rarity.value && card.rarity !== rarity.value) return false
    if (provenance.value === 'local' && card.source.kind !== 'local') return false
    if (provenance.value === 'imported' && card.source.kind !== 'imported') return false
    if (provenance.value.startsWith('author:') && card.author !== provenance.value.slice(7)) return false
    if (q && !normalize(`${card.name} ${card.subtitle} ${card.description}`).includes(q)) return false
    return true
  })
  return list.sort(compare[sort.value])
})

const compare: Record<Sort, (a: Card, b: Card) => number> = {
  recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  rarity: (a, b) => RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank || a.name.localeCompare(b.name, 'fr'),
  number: (a, b) => (a.number ?? 1e9) - (b.number ?? 1e9),
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const hasFilters = computed(
  () => !!(query.value || category.value || rarity.value || provenance.value),
)

function resetFilters() {
  query.value = category.value = rarity.value = provenance.value = ''
}

const viewerIndex = ref<number | null>(null)
const showImport = ref(false)
const showExport = ref(false)

async function loadSamples() {
  await document.fonts.load('600 92px "Cormorant Garamond"')
  const report = await store.importPack(buildSamplePack(), 'skip')
  toast.show(
    report.added ? `${report.added} cartes d’exemple ajoutées` : 'Les cartes d’exemple sont déjà là',
  )
}
</script>

<template>
  <div class="gallery">
    <section class="intro">
      <p class="eyebrow">Collection</p>
      <h1>Galerie</h1>
      <p class="muted">
        {{ store.cards.length }} carte{{ store.cards.length > 1 ? 's' : '' }} dans votre
        collection.
      </p>
      <div class="intro-actions">
        <button class="btn" type="button" @click="showImport = true"><Upload /> Importer</button>
        <button class="btn" type="button" :disabled="!store.cards.length" @click="showExport = true">
          <Download /> Exporter
        </button>
        <button class="btn btn-primary" type="button" @click="router.push('/editor')">
          <Plus /> Nouvelle carte
        </button>
      </div>
    </section>

    <section v-if="store.cards.length" class="toolbar">
      <label class="search">
        <Search />
        <input v-model="query" class="input" placeholder="Rechercher un nom, un poste…" />
      </label>
      <select v-model="category" class="select" aria-label="Collection">
        <option value="">Collections</option>
        <option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
        <option value="__none">Sans collection</option>
      </select>
      <select v-model="rarity" class="select" aria-label="Rareté">
        <option value="">Raretés</option>
        <option v-for="r in RARITY_LIST" :key="r" :value="r">{{ RARITY_INFO[r].label }}</option>
      </select>
      <select v-model="provenance" class="select" aria-label="Provenance">
        <option value="">Provenances</option>
        <option value="local">Créées ici</option>
        <option value="imported">Importées</option>
        <optgroup v-if="store.authors.length" label="Par auteur">
          <option v-for="a in store.authors" :key="a" :value="`author:${a}`">{{ a }}</option>
        </optgroup>
      </select>
      <select v-model="sort" class="select" aria-label="Tri">
        <option value="recent">Plus récentes</option>
        <option value="name">Nom</option>
        <option value="rarity">Rareté</option>
        <option value="number">Numéro</option>
      </select>
      <button v-if="hasFilters" class="btn btn-ghost btn-sm" type="button" @click="resetFilters">
        Réinitialiser
      </button>
    </section>

    <section v-if="filtered.length" class="grid">
      <button
        v-for="(card, index) in filtered"
        :key="card.id"
        type="button"
        class="tile"
        :aria-label="`Voir ${card.name || 'la carte'}`"
        @click="viewerIndex = index"
      >
        <CardView :card="card" :category="store.getCategory(card.categoryId)" interactive />
      </button>
    </section>

    <section v-else-if="store.cards.length" class="empty">
      <p>Aucune carte ne correspond à ces filtres.</p>
      <button class="btn btn-sm" type="button" @click="resetFilters">Réinitialiser les filtres</button>
    </section>

    <section v-else class="empty">
      <div class="empty-card" aria-hidden="true" />
      <h2>Votre collection est vide</h2>
      <p class="muted">Créez votre première carte, importez le paquet d’un collègue ou chargez quelques exemples.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" @click="router.push('/editor')">
          <Plus /> Créer une carte
        </button>
        <button class="btn" type="button" @click="showImport = true"><Upload /> Importer</button>
        <button class="btn btn-ghost" type="button" @click="loadSamples"><Sparkles /> Exemples</button>
      </div>
    </section>

    <p v-if="store.cards.length" class="samples-link">
      <button class="btn btn-ghost btn-sm" type="button" @click="loadSamples">
        <Sparkles /> Charger les cartes d’exemple
      </button>
    </p>

    <CardViewer
      v-if="viewerIndex !== null"
      v-model:index="viewerIndex"
      :cards="filtered"
      @close="viewerIndex = null"
    />
    <ImportDialog :open="showImport" @close="showImport = false" />
    <ExportDialog :open="showExport" :filtered="filtered" @close="showExport = false" />
  </div>
</template>

<style scoped>
.gallery {
  max-width: 1320px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-6) var(--space-7);
}

.intro {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-rows: auto auto auto;
  column-gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.intro h1 {
  font-size: 52px;
  line-height: 1.05;
  font-weight: 500;
}

.intro .muted {
  margin-top: var(--space-2);
}

.intro-actions {
  grid-column: 2;
  grid-row: 1 / 4;
  align-self: end;
  display: flex;
  gap: var(--space-2);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) 0;
  margin-bottom: var(--space-6);
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.toolbar .select {
  width: auto;
  min-width: 150px;
}

.search {
  position: relative;
  flex: 1 1 240px;
}

.search svg {
  position: absolute;
  left: 10px;
  top: 50%;
  translate: 0 -50%;
  width: 15px;
  height: 15px;
  color: var(--ink-3);
}

.search .input {
  padding-left: 32px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: var(--space-6) var(--space-5);
}

.tile {
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  border-radius: 12px;
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

.empty .row {
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--space-3);
}

.empty-card {
  width: 120px;
  aspect-ratio: 63 / 88;
  margin-bottom: var(--space-3);
  border: 1px solid var(--line-strong);
  border-radius: 8px;
  background:
    linear-gradient(var(--paper), var(--paper)) padding-box,
    repeating-linear-gradient(45deg, transparent 0 8px, var(--paper-2) 8px 9px);
  box-shadow:
    8px -6px 0 -1px var(--paper),
    8px -6px 0 0 var(--line),
    16px -12px 0 -1px var(--paper),
    16px -12px 0 0 var(--line);
  position: relative;
}

.empty-card::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 16px;
  height: 16px;
  transform: rotate(45deg);
  border: 1.5px solid var(--accent);
}

.samples-link {
  margin-top: var(--space-7);
  text-align: center;
}

@media (max-width: 860px) {
  .gallery {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .intro {
    grid-template-columns: 1fr;
    margin-bottom: var(--space-4);
  }

  .intro h1 {
    font-size: 40px;
  }

  .intro-actions {
    grid-column: 1;
    grid-row: auto;
    margin-top: var(--space-4);
  }

  .intro-actions .btn {
    flex: 1;
    padding: 0 var(--space-2);
  }

  /* La création passe par la barre d'onglets. */
  .intro-actions .btn-primary {
    display: none;
  }

  .toolbar {
    display: grid;
    grid-template-columns: 1fr 1fr;
    margin-bottom: var(--space-5);
  }

  .search {
    grid-column: 1 / -1;
  }

  .toolbar .select {
    min-width: 0;
    width: 100%;
  }

  .toolbar .btn-ghost {
    grid-column: 1 / -1;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-5) var(--space-3);
  }

  .samples-link {
    margin-top: var(--space-6);
  }
}

@media (min-width: 600px) and (max-width: 860px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
