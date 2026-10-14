<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Ban,
  Check,
  Download,
  Eye,
  EyeOff,
  ListChecks,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-vue-next'
import { RARITY_INFO, RARITY_LIST, type Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { buildSamplePack } from '@/lib/samples'
import { errorMessage } from '@/api/client'
import CardView from '@/components/card/CardView.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'
import ImportDialog from '@/components/gallery/ImportDialog.vue'
import ExportDialog from '@/components/gallery/ExportDialog.vue'
import RejectDialog from '@/components/gallery/RejectDialog.vue'

const store = useCardsStore()
const router = useRouter()
const toast = useToast()
const version = import.meta.env.VITE_APP_VERSION || 'dev'

type Sort = 'recent' | 'name' | 'rarity' | 'number'

const query = ref('')
const category = ref<string>('')
const rarity = ref<string>('')
const provenance = ref<string>('')
const status = ref<string>('')
const sort = ref<Sort>('recent')

const filtered = computed(() => {
  const q = normalize(query.value)
  const list = store.cards.filter((card) => {
    if (
      category.value === '__none'
        ? card.categoryId
        : category.value && card.categoryId !== category.value
    )
      return false
    if (rarity.value && card.rarity !== rarity.value) return false
    if (status.value && !hasStatus(card.id, status.value)) return false
    if (provenance.value === 'players' && !store.infoOf(card.id)?.createdBy) return false
    if (provenance.value === 'local' && card.source.kind !== 'local') return false
    if (provenance.value === 'imported' && card.source.kind !== 'imported') return false
    if (provenance.value.startsWith('author:') && card.author !== provenance.value.slice(7))
      return false
    if (q && !normalize(`${card.name} ${card.subtitle} ${card.description}`).includes(q))
      return false
    return true
  })
  return list.sort(compare[sort.value])
})

const compare: Record<Sort, (a: Card, b: Card) => number> = {
  recent: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  name: (a, b) => a.name.localeCompare(b.name, 'fr'),
  rarity: (a, b) =>
    RARITY_INFO[b.rarity].rank - RARITY_INFO[a.rarity].rank || a.name.localeCompare(b.name, 'fr'),
  number: (a, b) => (a.number ?? 1e9) - (b.number ?? 1e9),
}

/** Statuts du filtre : ceux de la carte, plus l'état des propositions de joueurs. */
function hasStatus(id: string, value: string) {
  if (value === 'pending') return store.isPendingProposal(id)
  if (value === 'rejected') return store.statusOf(id) === 'draft' && !!store.infoOf(id)?.rejectedAt
  return store.statusOf(id) === value
}

/** Pastille d'une carte non publiée. */
function draftLabel(id: string) {
  if (store.statusOf(id) === 'published') return null
  if (store.isPendingProposal(id)) return 'À valider'
  return store.infoOf(id)?.rejectedAt ? 'Refusée' : 'Brouillon'
}

function showPending() {
  resetFilters()
  status.value = 'pending'
}

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

const hasFilters = computed(
  () => !!(query.value || category.value || rarity.value || provenance.value || status.value),
)

function resetFilters() {
  query.value = category.value = rarity.value = provenance.value = status.value = ''
}

const publishedCount = computed(
  () => store.cards.filter((c) => store.statusOf(c.id) === 'published').length,
)
// ---------- Sélection ----------
// Les actions portent sur les cartes sélectionnées encore visibles avec les filtres actuels.

const selecting = ref(false)
const selection = ref(new Set<string>())

const selectedIds = computed(() =>
  filtered.value.filter((c) => selection.value.has(c.id)).map((c) => c.id),
)
const selectedDrafts = computed(() =>
  selectedIds.value.filter((id) => store.statusOf(id) === 'draft'),
)
const selectedPublished = computed(() =>
  selectedIds.value.filter((id) => store.statusOf(id) === 'published'),
)
const selectedProposals = computed(() =>
  selectedDrafts.value.filter((id) => !!store.infoOf(id)?.createdBy),
)
const allSelected = computed(
  () => !!filtered.value.length && selectedIds.value.length === filtered.value.length,
)

function toggleSelecting() {
  selecting.value = !selecting.value
  selection.value = new Set()
}

function toggle(id: string) {
  const next = new Set(selection.value)
  if (!next.delete(id)) next.add(id)
  selection.value = next
}

function toggleAll() {
  selection.value = allSelected.value ? new Set() : new Set(filtered.value.map((c) => c.id))
}

function onTile(card: Card, index: number) {
  if (selecting.value) toggle(card.id)
  else viewerIndex.value = index
}

const showReject = ref(false)

async function removeSelected() {
  const ids = selectedIds.value
  const n = ids.length
  const published = selectedPublished.value.length
  const warning = published
    ? ` ${published} est publiée${published > 1 ? 's' : ''} : les joueurs qui la possèdent la perdront.`
    : ''
  if (!n || !confirm(`Supprimer définitivement ${n} carte${n > 1 ? 's' : ''} ?${warning}`)) return
  try {
    await store.removeCards(ids)
    selection.value = new Set()
    toast.show(`${n} carte${n > 1 ? 's' : ''} supprimée${n > 1 ? 's' : ''}`)
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

async function setStatus(ids: string[], next: 'draft' | 'published') {
  const n = ids.length
  const verb = next === 'published' ? 'Publier' : 'Retirer du jeu'
  if (!n || !confirm(`${verb} ${n} carte${n > 1 ? 's' : ''} ?`)) return
  try {
    await store.setStatus(ids, next)
    selection.value = new Set()
    toast.show(
      next === 'published'
        ? `${n} carte${n > 1 ? 's' : ''} publiée${n > 1 ? 's' : ''}`
        : `${n} carte${n > 1 ? 's' : ''} repassée${n > 1 ? 's' : ''} en brouillon`,
    )
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

const viewerIndex = ref<number | null>(null)
const showImport = ref(false)
const showExport = ref(false)

async function loadSamples() {
  await document.fonts.load('600 92px "Cormorant Garamond"')
  try {
    const report = await store.importPack(buildSamplePack(), 'skip')
    toast.show(
      report.added
        ? `${report.added} cartes d’exemple ajoutées en brouillon`
        : 'Les cartes d’exemple sont déjà là',
    )
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
</script>

<template>
  <div class="gallery">
    <section class="intro">
      <p class="muted">
        {{ store.cards.length }} carte{{ store.cards.length > 1 ? 's' : '' }} ·
        {{ publishedCount }} publiée{{ publishedCount > 1 ? 's' : '' }}
        <button
          v-if="store.pendingProposals"
          class="pending-link"
          type="button"
          @click="showPending"
        >
          {{ store.pendingProposals }} proposition{{ store.pendingProposals > 1 ? 's' : '' }} à
          valider
        </button>
      </p>
      <div class="intro-actions">
        <button class="btn" type="button" @click="showImport = true"><Upload /> Importer</button>
        <button
          class="btn"
          type="button"
          :disabled="!store.cards.length"
          @click="showExport = true"
        >
          <Download /> Exporter
        </button>
        <button class="btn btn-primary" type="button" @click="router.push('/admin/editor')">
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
        <option value="players">Proposées par des joueurs</option>
        <optgroup v-if="store.authors.length" label="Par auteur">
          <option v-for="a in store.authors" :key="a" :value="`author:${a}`">{{ a }}</option>
        </optgroup>
      </select>
      <select v-model="status" class="select" aria-label="Statut">
        <option value="">Statuts</option>
        <option value="published">Publiées</option>
        <option value="draft">Brouillons</option>
        <option value="pending">À valider</option>
        <option value="rejected">Refusées</option>
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
      <button
        class="btn btn-sm select-toggle"
        :class="{ 'btn-primary': selecting }"
        type="button"
        :aria-pressed="selecting"
        @click="toggleSelecting"
      >
        <ListChecks /> {{ selecting ? 'Terminer' : 'Sélectionner' }}
      </button>
    </section>

    <section v-if="filtered.length" class="grid">
      <button
        v-for="(card, index) in filtered"
        :key="card.id"
        type="button"
        class="tile"
        :class="{ selecting, selected: selection.has(card.id) }"
        :aria-label="
          selecting ? `Sélectionner ${card.name || 'la carte'}` : `Voir ${card.name || 'la carte'}`
        "
        :aria-pressed="selecting ? selection.has(card.id) : undefined"
        @click="onTile(card, index)"
      >
        <CardView :card="card" :category="store.getCategory(card.categoryId)" interactive />
        <span
          v-if="draftLabel(card.id)"
          class="draft-pill"
          :class="{ rejected: draftLabel(card.id) === 'Refusée' }"
        >
          {{ draftLabel(card.id) }}
        </span>
        <span v-if="store.infoOf(card.id)?.createdBy" class="creator-pill">
          par {{ store.infoOf(card.id)?.createdBy?.displayName }}
        </span>
        <span v-if="selecting" class="check" aria-hidden="true"><Check /></span>
      </button>
    </section>

    <section v-else-if="store.cards.length" class="empty">
      <p>Aucune carte ne correspond à ces filtres.</p>
      <button class="btn btn-sm" type="button" @click="resetFilters">
        Réinitialiser les filtres
      </button>
    </section>

    <section v-else class="empty">
      <div class="empty-card" aria-hidden="true" />
      <h2>Aucune carte pour l’instant</h2>
      <p class="muted">Créez la première carte, importez un paquet ou chargez quelques exemples.</p>
      <div class="row">
        <button class="btn btn-primary" type="button" @click="router.push('/admin/editor')">
          <Plus /> Créer une carte
        </button>
        <button class="btn" type="button" @click="showImport = true"><Upload /> Importer</button>
        <button class="btn btn-ghost" type="button" @click="loadSamples">
          <Sparkles /> Exemples
        </button>
      </div>
    </section>

    <p v-if="store.cards.length" class="samples-link">
      <button class="btn btn-ghost btn-sm" type="button" @click="loadSamples">
        <Sparkles /> Charger les cartes d’exemple
      </button>
    </p>

    <p class="version muted">AxoMaster · {{ version }}</p>

    <div v-if="selecting" class="selection-bar" role="toolbar" aria-label="Cartes sélectionnées">
      <span class="selection-count">
        {{ selectedIds.length }} sélectionnée{{ selectedIds.length > 1 ? 's' : '' }}
      </span>
      <button class="btn btn-ghost btn-sm" type="button" @click="toggleAll">
        {{ allSelected ? 'Aucune' : `Tout (${filtered.length})` }}
      </button>
      <div class="selection-actions">
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="!selectedDrafts.length"
          @click="setStatus(selectedDrafts, 'published')"
        >
          <Eye /> Publier<span v-if="selectedDrafts.length">&nbsp;{{ selectedDrafts.length }}</span>
        </button>
        <button
          class="btn btn-sm"
          type="button"
          :disabled="!selectedProposals.length"
          @click="showReject = true"
        >
          <Ban /> Refuser
        </button>
        <button
          class="btn btn-sm"
          type="button"
          :disabled="!selectedPublished.length"
          @click="setStatus(selectedPublished, 'draft')"
        >
          <EyeOff /> Retirer du jeu
        </button>
        <button
          class="btn btn-sm btn-danger btn-icon"
          type="button"
          title="Supprimer"
          aria-label="Supprimer la sélection"
          :disabled="!selectedIds.length"
          @click="removeSelected"
        >
          <Trash2 />
        </button>
        <button
          class="btn btn-ghost btn-sm btn-icon"
          type="button"
          title="Quitter la sélection"
          aria-label="Quitter la sélection"
          @click="toggleSelecting"
        >
          <X />
        </button>
      </div>
    </div>

    <CardViewer
      v-if="viewerIndex !== null"
      v-model:index="viewerIndex"
      :cards="filtered"
      @close="viewerIndex = null"
    />
    <ImportDialog :open="showImport" @close="showImport = false" />
    <ExportDialog :open="showExport" :filtered="filtered" @close="showExport = false" />
    <RejectDialog
      :open="showReject"
      :ids="selectedProposals"
      @close="showReject = false"
      @done="selection = new Set()"
    />
  </div>
</template>

<style scoped>
.gallery {
  max-width: 1320px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.intro {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3) var(--space-5);
  margin-bottom: var(--space-5);
}

.intro-actions {
  display: flex;
  gap: var(--space-2);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-4);
  margin-bottom: var(--space-6);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--paper-2);
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
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--album);
}

.tile {
  position: relative;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.tile.selecting {
  cursor: pointer;
}

.tile.selected {
  outline: 3px solid var(--accent);
  outline-offset: 3px;
}

.check {
  position: absolute;
  top: -8px;
  left: -8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: rgb(15 23 42 / 0.45);
  color: transparent;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.3);
}

.check svg {
  width: 16px;
  height: 16px;
}

.tile.selected .check {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.creator-pill {
  position: absolute;
  bottom: 8px;
  left: 50%;
  translate: -50% 0;
  max-width: calc(100% - 16px);
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
}

.pending-link {
  margin-left: var(--space-2);
  padding: 2px 10px;
  border: 0;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font: 500 12px var(--font-sans);
  cursor: pointer;
}

.select-toggle {
  margin-left: auto;
}

.selection-bar {
  position: sticky;
  /* Au-dessus de la barre d'onglets mobile. */
  bottom: calc(var(--tabbar-h) + var(--space-3));
  z-index: 10;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
  width: fit-content;
  max-width: 100%;
  margin: var(--space-5) auto 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 8px 30px rgb(15 23 42 / 0.18);
}

.selection-count {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.selection-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.draft-pill {
  position: absolute;
  top: 8px;
  left: 50%;
  translate: -50% 0;
  padding: 2px 8px;
  border-radius: 10px;
  background: rgb(15 23 42 / 0.78);
  color: #f1f5f9;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  pointer-events: none;
}

.draft-pill.rejected {
  background: var(--danger);
  color: #fff;
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

.version {
  margin-top: var(--space-5);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-align: center;
}

@media (max-width: 860px) {
  .selection-bar {
    width: 100%;
  }

  .selection-actions {
    flex: 1 1 100%;
  }

  .gallery {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .intro {
    margin-bottom: var(--space-4);
  }

  .intro-actions {
    width: 100%;
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

  .toolbar .btn-ghost,
  .bulk {
    grid-column: 1 / -1;
  }

  .bulk {
    margin-left: 0;
  }

  .bulk .btn {
    flex: 1;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-5) var(--space-3);
    padding: var(--space-3);
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
