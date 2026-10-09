<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Copy, Image, Pencil, Trash2, X } from 'lucide-vue-next'
import type { Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { exportCardPng } from '@/lib/exportPng'
import { errorMessage } from '@/api/client'
import CardView from '@/components/card/CardView.vue'

const props = defineProps<{
  cards: Card[]
  /** Consultation seule (joueurs) : pas de modification ni de suppression. */
  readonly?: boolean
  /** Nombre d'exemplaires possédés, par carte. */
  quantities?: Record<string, number>
  /** Rendue sur place plutôt que dans `body` : nécessaire au-dessus d'un `<dialog>` modal. */
  inline?: boolean
}>()
const index = defineModel<number>('index', { required: true })
const emit = defineEmits<{ close: [] }>()

const store = useCardsStore()
const router = useRouter()
const toast = useToast()
const view = ref<InstanceType<typeof CardView>>()

const card = computed(() => props.cards[index.value])
const category = computed(() => store.getCategory(card.value?.categoryId))
const sourceLabel = computed(() => {
  const c = card.value
  if (!c) return ''
  if (c.source.kind === 'imported') return `Importée de ${c.source.from}`
  return 'Créée ici'
})

watch(card, (c) => {
  if (c) return
  if (props.cards.length) index.value = props.cards.length - 1
  else emit('close')
})

function go(delta: number) {
  const n = props.cards.length
  if (n) index.value = (index.value + delta + n) % n
}

// Balayage horizontal au doigt pour passer d'une carte à l'autre.
let swipe: { x: number; y: number; id: number } | null = null
let swiped = false

function onSwipeStart(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId }
  swiped = false
}

function onSwipeEnd(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.id) return
  const dx = e.clientX - swipe.x
  const dy = e.clientY - swipe.y
  swipe = null
  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    swiped = true
    go(dx < 0 ? 1 : -1)
  }
}

function closeFromBackdrop() {
  if (!swiped) emit('close')
  swiped = false
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    // Ne ferme pas aussi le dialogue modal sous-jacent.
    e.preventDefault()
    emit('close')
  } else if (e.key === 'ArrowRight') go(1)
  else if (e.key === 'ArrowLeft') go(-1)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})

function edit() {
  if (card.value) router.push(`/admin/editor/${card.value.id}`)
}

async function duplicate() {
  if (!card.value) return
  try {
    const copy = await store.duplicateCard(card.value.id)
    if (copy) router.push(`/admin/editor/${copy.id}`)
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

async function exportPng() {
  const inner = view.value?.inner
  if (!inner || !card.value) return
  try {
    await exportCardPng(inner, card.value.name || 'carte')
  } catch (err) {
    console.error(err)
    toast.error("L'export PNG a échoué.")
  }
}

async function remove() {
  const c = card.value
  if (!c) return
  const warning =
    store.statusOf(c.id) === 'published'
      ? ' Elle est publiée : les joueurs qui la possèdent la perdront.'
      : ''
  if (!confirm(`Supprimer définitivement « ${c.name || 'cette carte'} » ?${warning}`)) return
  try {
    await store.removeCard(c.id)
    toast.show('Carte supprimée')
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
</script>

<template>
  <Teleport to="body" :disabled="inline">
    <div
      class="viewer"
      role="dialog"
      aria-modal="true"
      @click.self="closeFromBackdrop"
      @pointerdown="onSwipeStart"
      @pointerup="onSwipeEnd"
      @pointercancel="swipe = null"
    >
      <button
        class="close btn btn-ghost btn-icon"
        type="button"
        aria-label="Fermer"
        @click="emit('close')"
      >
        <X />
      </button>

      <button
        v-if="cards.length > 1"
        class="nav prev"
        type="button"
        aria-label="Carte précédente"
        @click="go(-1)"
      >
        <ChevronLeft />
      </button>

      <div v-if="card" class="stage" @click.self="closeFromBackdrop">
        <Transition name="swap" mode="out-in">
          <div :key="card.id" class="card-wrap">
            <CardView ref="view" :card="card" :category="category" interactive />
          </div>
        </Transition>

        <aside class="meta">
          <p class="eyebrow">{{ category?.name ?? 'Sans collection' }}</p>
          <h2>{{ card.name || 'Sans titre' }}</h2>
          <p class="sub">{{ card.subtitle }}</p>
          <p v-if="cards.length > 1" class="position">
            {{ index + 1 }} / {{ cards.length }} · balayez pour naviguer
          </p>
          <dl>
            <div v-if="!readonly">
              <dt>Auteur</dt>
              <dd>{{ card.author || '—' }}</dd>
            </div>
            <div v-if="!readonly">
              <dt>Provenance</dt>
              <dd>{{ sourceLabel }}</dd>
            </div>
            <div v-if="!readonly">
              <dt>Statut</dt>
              <dd>{{ store.statusOf(card.id) === 'published' ? 'Publiée' : 'Brouillon' }}</dd>
            </div>
            <div v-if="quantities">
              <dt>Exemplaires</dt>
              <dd>{{ quantities[card.id] ?? 0 }}</dd>
            </div>
            <div>
              <dt>Position</dt>
              <dd>{{ index + 1 }} / {{ cards.length }}</dd>
            </div>
          </dl>
          <div class="actions">
            <template v-if="!readonly">
              <button class="btn btn-sm" type="button" @click="edit"><Pencil /> Modifier</button>
              <button class="btn btn-sm" type="button" @click="duplicate">
                <Copy /> Dupliquer
              </button>
            </template>
            <button class="btn btn-sm" type="button" @click="exportPng"><Image /> PNG</button>
            <button v-if="!readonly" class="btn btn-sm btn-danger" type="button" @click="remove">
              <Trash2 /> Supprimer
            </button>
          </div>
        </aside>
      </div>

      <button
        v-if="cards.length > 1"
        class="nav next"
        type="button"
        aria-label="Carte suivante"
        @click="go(1)"
      >
        <ChevronRight />
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 23 42 / 0.92);
  backdrop-filter: blur(6px);
  animation: fade 0.2s ease-out;
}

@keyframes fade {
  from {
    opacity: 0;
  }
}

.stage {
  display: flex;
  align-items: center;
  gap: var(--space-7);
  height: 100%;
  padding: var(--space-6);
}

.card-wrap {
  height: min(88vh, 900px);
  aspect-ratio: 630 / 880;
}

.meta {
  width: 240px;
  color: #e2e8f0;
}

.meta h2 {
  margin-top: var(--space-2);
  font-size: 34px;
  font-weight: 500;
  line-height: 1.1;
}

.sub {
  margin-top: var(--space-1);
  font: 400 15px var(--font-display);
  color: #94a3b8;
}

dl {
  margin: var(--space-5) 0;
  padding: var(--space-3) 0;
  border-top: 1px solid rgb(255 255 255 / 0.12);
  border-bottom: 1px solid rgb(255 255 255 / 0.12);
}

dl div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 3px 0;
}

dt {
  color: #64748b;
}

dd {
  margin: 0;
  text-align: right;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.actions .btn {
  background: transparent;
  border-color: rgb(255 255 255 / 0.2);
  color: #e2e8f0;
}

.actions .btn:hover {
  background: rgb(255 255 255 / 0.08);
  border-color: rgb(255 255 255 / 0.4);
}

.actions .btn-danger {
  color: #fca5a5;
}

.close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  color: #e2e8f0;
}

.close:hover {
  background: rgb(255 255 255 / 0.08);
}

.nav {
  position: absolute;
  top: 50%;
  translate: 0 -50%;
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 50%;
  background: transparent;
  color: #e2e8f0;
  cursor: pointer;
}

.nav:hover {
  background: rgb(255 255 255 / 0.08);
}

.prev {
  left: var(--space-5);
}

.next {
  right: var(--space-5);
}

.swap-enter-active,
.swap-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.swap-enter-from {
  opacity: 0;
  transform: translateY(10px) scale(0.98);
}

.swap-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

.position {
  display: none;
}

@media (max-width: 960px) {
  .viewer {
    touch-action: none;
  }

  .stage {
    flex-direction: column;
    justify-content: center;
    gap: var(--space-4);
    width: 100%;
    padding: calc(var(--space-7) + env(safe-area-inset-top)) var(--space-4)
      calc(var(--space-4) + env(safe-area-inset-bottom));
  }

  .card-wrap {
    height: auto;
    width: min(86vw, 58dvh, 520px);
  }

  .meta {
    width: min(100%, 420px);
    text-align: center;
  }

  .meta h2 {
    font-size: 26px;
  }

  .sub {
    font-size: 17px;
  }

  .meta dl {
    display: none;
  }

  .position {
    display: block;
    margin-top: var(--space-1);
    font-size: 12px;
    color: #64748b;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    margin-top: var(--space-4);
  }

  .actions .btn {
    flex-direction: column;
    gap: 4px;
    height: 56px;
    padding: 0;
    font-size: 11px;
  }

  .actions .btn svg {
    width: 18px;
    height: 18px;
  }

  .close {
    top: calc(var(--space-3) + env(safe-area-inset-top));
    right: var(--space-3);
  }

  .nav {
    top: auto;
    bottom: var(--space-4);
    translate: none;
  }
}

/* Au doigt, on balaie : les flèches deviennent inutiles. */
@media (max-width: 960px) and (pointer: coarse) {
  .nav {
    display: none;
  }
}
</style>
