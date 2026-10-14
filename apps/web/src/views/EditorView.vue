<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Check, Image, Layers, Redo2, SlidersHorizontal, Undo2 } from 'lucide-vue-next'
import { createBlankCard, type Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useCreationsStore } from '@/stores/creations'
import { provideEditor } from '@/composables/editor'
import { useHistory } from '@/composables/useHistory'
import { useToast } from '@/composables/useToast'
import { MOBILE_QUERY, useMediaQuery } from '@/composables/useMediaQuery'
import { clone } from '@/lib/clone'
import { exportCardPng } from '@/lib/exportPng'
import { errorMessage } from '@/api/client'
import EditorCanvas from '@/components/editor/EditorCanvas.vue'
import LayerPanel from '@/components/editor/LayerPanel.vue'
import PropertiesPanel from '@/components/editor/PropertiesPanel.vue'

const route = useRoute()
const router = useRouter()
const store = useCardsStore()
const creations = useCreationsStore()
const toast = useToast()

/**
 * L'éditeur sert aux admins (galerie) et aux joueurs (« Mes créations ») : seuls changent
 * l'enregistrement, la page de retour et les champs réservés à l'admin (cf. PropertiesPanel).
 */
const admin = !!route.meta.admin
const home = admin ? '/admin' : '/creations'
const homeLabel = admin ? 'Galerie' : 'Mes créations'

function findCard(id: string): Card | undefined {
  if (admin) return store.getCard(id)
  const creation = creations.getCreation(id)
  if (creation?.status === 'published') {
    toast.error('Cette carte est validée : elle ne peut plus être modifiée.')
    return undefined
  }
  return creation?.card
}

async function saveCard(card: Card): Promise<Card> {
  return admin ? store.saveCard(card) : (await creations.save(card)).card
}

/** Motif du refus d'une proposition, montré au joueur pendant qu'il la corrige. */
const reviewNote = computed(() => {
  if (admin) return null
  const creation = creations.getCreation(draft.value.id)
  return creation?.status === 'rejected' ? (creation.reviewNote ?? '') : null
})

const remaining = computed(() => {
  const quota = creations.quota
  return !admin && quota && !quota.unlimited ? quota.remaining : null
})

const draft = ref<Card>(createBlankCard(store.authorName))
const savedJson = ref('')
const isNew = ref(true)
const canvas = ref<InstanceType<typeof EditorCanvas>>()

const history = useHistory(draft)
const editor = provideEditor(draft, history.commit)

// Sur mobile, les deux panneaux latéraux deviennent des onglets sous la carte.
const isMobile = useMediaQuery(MOBILE_QUERY)
const tab = ref<'layers' | 'props'>('props')
watch(editor.selected, () => (tab.value = 'props'))

const propsLabel = computed(() => {
  const selected = editor.selected.value
  if (selected === 'card') return 'Carte'
  if (selected === 'photo') return 'Photo'
  return editor.selectedLayer.value?.name ?? 'Réglages'
})

function load(id: string | undefined) {
  const existing = id ? findCard(id) : undefined
  if (id && !existing) {
    if (admin || creations.getCreation(id)?.status !== 'published')
      toast.error('Cette carte n’existe pas (ou plus).')
    router.replace(home)
    return
  }
  isNew.value = !existing
  draft.value = existing ? clone(existing) : createBlankCard(store.authorName)
  savedJson.value = JSON.stringify(draft.value)
  editor.selected.value = 'card'
  history.reset()
}

watch(
  () => route.params.id as string | undefined,
  (id) => {
    // Après le premier enregistrement d'une nouvelle carte, l'URL change mais le brouillon est déjà à jour.
    if (id && id === draft.value.id) return
    load(id)
  },
  { immediate: true },
)

const dirty = computed(() => JSON.stringify(draft.value) !== savedJson.value)

const saving = ref(false)

async function save() {
  if (saving.value) return
  saving.value = true
  try {
    if (isNew.value) draft.value.author = store.authorName
    const snapshot = JSON.stringify(draft.value)
    const saved = await saveCard(draft.value)
    // Champs fixés par le serveur pour une proposition de joueur (signature, numéro).
    const fixed = { updatedAt: saved.updatedAt, author: saved.author, number: saved.number }
    Object.assign(draft.value, fixed)
    // Les modifications faites pendant l'envoi restent « non enregistrées ».
    savedJson.value = JSON.stringify({ ...JSON.parse(snapshot), ...fixed })
    history.reset()
    toast.show(admin ? 'Carte enregistrée' : 'Carte envoyée pour validation')
    if (isNew.value) {
      isNew.value = false
      router.replace(`${home}/editor/${saved.id}`)
    }
  } catch (err) {
    toast.error(`Enregistrement impossible : ${errorMessage(err)}`)
  } finally {
    saving.value = false
  }
}

async function exportPng() {
  const inner = canvas.value?.getInner()
  if (!inner) return
  editor.selected.value = 'card'
  try {
    await exportCardPng(inner, draft.value.name || 'carte')
  } catch (err) {
    console.error(err)
    toast.error("L'export PNG a échoué.")
  }
}

onBeforeRouteLeave(() => {
  if (dirty.value)
    return confirm('Des modifications ne sont pas enregistrées. Quitter quand même ?')
})

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function onKey(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey
  const key = e.key.toLowerCase()
  if (mod && key === 's') {
    e.preventDefault()
    save()
    return
  }
  if (isTyping(e.target)) return

  if (mod && key === 'z') {
    e.preventDefault()
    if (e.shiftKey) history.redo()
    else history.undo()
    return
  }
  if (mod && key === 'y') {
    e.preventDefault()
    history.redo()
    return
  }

  const layer = editor.selectedLayer.value
  if (!layer) return
  if (mod && key === 'd') {
    e.preventDefault()
    editor.duplicateLayer(layer.id)
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    editor.removeLayer(layer.id)
  } else if (e.key === 'Escape') {
    editor.selected.value = 'card'
  } else if (e.key.startsWith('Arrow') && !layer.locked) {
    e.preventDefault()
    const step = e.shiftKey ? 2 : 0.5
    if (e.key === 'ArrowLeft') layer.x -= step
    if (e.key === 'ArrowRight') layer.x += step
    if (e.key === 'ArrowUp') layer.y -= step
    if (e.key === 'ArrowDown') layer.y += step
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  // Nettoie les images envoyées mais jamais enregistrées (après un délai de grâce côté serveur).
  if (admin) store.collectGarbage()
})
</script>

<template>
  <div class="editor">
    <div class="bar">
      <RouterLink
        :to="home"
        class="btn btn-ghost btn-sm back"
        :aria-label="`Retour : ${homeLabel}`"
      >
        <ArrowLeft /> <span class="text">{{ homeLabel }}</span>
      </RouterLink>
      <div class="title">
        <span class="eyebrow">
          {{ isNew ? 'Nouvelle carte' : 'Modifier' }}
          <template v-if="isNew && remaining !== null">
            · {{ remaining }} création{{ remaining > 1 ? 's' : '' }} restante{{
              remaining > 1 ? 's' : ''
            }}
          </template>
        </span>
        <h1>{{ draft.name || 'Sans titre' }}</h1>
      </div>
      <div class="row actions">
        <span class="status muted" :class="{ dirty }">
          {{ dirty ? 'Non enregistrée' : 'Enregistrée' }}
        </span>
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          title="Annuler (Ctrl+Z)"
          aria-label="Annuler"
          :disabled="!history.canUndo.value"
          @click="history.undo()"
        >
          <Undo2 />
        </button>
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          title="Rétablir (Ctrl+Y)"
          aria-label="Rétablir"
          :disabled="!history.canRedo.value"
          @click="history.redo()"
        >
          <Redo2 />
        </button>
        <button
          class="btn btn-sm png"
          type="button"
          title="Exporter en image"
          aria-label="Exporter en PNG"
          @click="exportPng"
        >
          <Image /> <span class="text">PNG</span>
        </button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="!dirty || saving"
          @click="save"
        >
          <Check /> {{ admin ? 'Enregistrer' : isNew ? 'Proposer' : 'Renvoyer' }}
        </button>
      </div>
    </div>

    <p v-if="reviewNote !== null" class="review" role="note">
      <strong>Carte refusée.</strong>
      {{ reviewNote || 'Aucun motif précisé.' }}
      Corrigez-la puis renvoyez-la pour une nouvelle validation.
    </p>

    <div class="workspace">
      <aside v-show="!isMobile || tab === 'layers'" class="side left"><LayerPanel /></aside>
      <section class="center"><EditorCanvas ref="canvas" /></section>
      <aside v-show="!isMobile || tab === 'props'" class="side right"><PropertiesPanel /></aside>

      <nav v-if="isMobile" class="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'layers'"
          :class="{ active: tab === 'layers' }"
          @click="tab = 'layers'"
        >
          <Layers /> Calques
          <span v-if="draft.layers.length" class="count">{{ draft.layers.length }}</span>
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="tab === 'props'"
          :class="{ active: tab === 'props' }"
          @click="tab = 'props'"
        >
          <SlidersHorizontal /> <span class="tab-label">{{ propsLabel }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--header-h));
}

.bar {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  height: 60px;
  padding: 0 var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--surface);
}

.back {
  justify-self: start;
}

.title {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.title .eyebrow {
  font-size: 10px;
}

.title h1 {
  max-width: 40vw;
  font-size: 22px;
  font-weight: 500;
  line-height: 1.1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bar .row {
  justify-self: end;
}

.status {
  margin-right: var(--space-2);
  font-size: 12px;
}

.status.dirty {
  color: var(--accent);
}

.review {
  margin: 0;
  padding: var(--space-2) var(--space-4);
  border-bottom: 1px solid var(--line);
  background: var(--paper-2);
  font-size: 13px;
  color: var(--ink-2);
}

.workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px 1fr 340px;
}

.side {
  overflow-y: auto;
  background: var(--paper);
}

.left {
  border-right: 1px solid var(--line);
}

.right {
  border-left: 1px solid var(--line);
}

.center {
  min-width: 0;
}

@media (max-width: 1100px) {
  .workspace {
    grid-template-columns: 230px 1fr 300px;
  }
}

/* Mobile : plein écran, carte en haut, panneau à onglets en bas. */
@media (max-width: 860px) {
  .editor {
    height: 100dvh;
    padding-top: env(safe-area-inset-top);
  }

  .bar {
    grid-template-columns: auto 1fr;
    gap: var(--space-2);
    height: 56px;
    padding: 0 var(--space-2);
  }

  .title,
  .status,
  .text {
    display: none;
  }

  .back,
  .png {
    width: 40px;
    padding: 0;
  }

  .actions {
    gap: 2px;
  }

  .workspace {
    display: flex;
    flex-direction: column;
  }

  .center {
    flex: 1 1 auto;
    min-height: 220px;
  }

  .tabs {
    order: 1;
    flex: none;
    display: grid;
    grid-template-columns: 1fr 1fr;
    border-top: 1px solid var(--line);
    background: var(--surface);
  }

  .tabs button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-2);
    min-width: 0;
    height: 46px;
    padding: 0 var(--space-3);
    border: 0;
    border-bottom: 2px solid transparent;
    background: transparent;
    font: 500 13px var(--font-sans);
    color: var(--ink-3);
    cursor: pointer;
  }

  .tabs button.active {
    color: var(--ink);
    border-bottom-color: var(--accent);
  }

  .tabs svg {
    flex: none;
    width: 16px;
    height: 16px;
  }

  .tab-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    min-width: 18px;
    padding: 0 5px;
    border-radius: 9px;
    background: var(--paper-3);
    font-size: 11px;
    line-height: 18px;
  }

  .side {
    order: 2;
    flex: none;
    height: min(46dvh, 440px);
    padding-bottom: env(safe-area-inset-bottom);
    border: 0;
  }
}
</style>
