<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, Copy, Image, Pencil, Trash2, X } from 'lucide-vue-next'
import type { Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { exportCardPng } from '@/lib/exportPng'
import CardView from '@/components/card/CardView.vue'

const props = defineProps<{ cards: Card[] }>()
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

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  else if (e.key === 'ArrowRight') go(1)
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
  if (card.value) router.push(`/editor/${card.value.id}`)
}

function duplicate() {
  if (!card.value) return
  const copy = store.duplicateCard(card.value.id)
  if (copy) router.push(`/editor/${copy.id}`)
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
  if (!c || !confirm(`Supprimer définitivement « ${c.name || 'cette carte'} » ?`)) return
  await store.removeCard(c.id)
  toast.show('Carte supprimée')
}
</script>

<template>
  <Teleport to="body">
    <div class="viewer" role="dialog" aria-modal="true" @click.self="emit('close')">
      <button class="close btn btn-ghost btn-icon" type="button" aria-label="Fermer" @click="emit('close')">
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

      <div v-if="card" class="stage" @click.self="emit('close')">
        <Transition name="swap" mode="out-in">
          <div :key="card.id" class="card-wrap">
            <CardView ref="view" :card="card" :category="category" interactive />
          </div>
        </Transition>

        <aside class="meta">
          <p class="eyebrow">{{ category?.name ?? 'Sans collection' }}</p>
          <h2>{{ card.name || 'Sans titre' }}</h2>
          <p class="sub">{{ card.subtitle }}</p>
          <dl>
            <div><dt>Auteur</dt><dd>{{ card.author || '—' }}</dd></div>
            <div><dt>Provenance</dt><dd>{{ sourceLabel }}</dd></div>
            <div><dt>Position</dt><dd>{{ index + 1 }} / {{ cards.length }}</dd></div>
          </dl>
          <div class="actions">
            <button class="btn btn-sm" type="button" @click="edit"><Pencil /> Modifier</button>
            <button class="btn btn-sm" type="button" @click="duplicate"><Copy /> Dupliquer</button>
            <button class="btn btn-sm" type="button" @click="exportPng"><Image /> PNG</button>
            <button class="btn btn-sm btn-danger" type="button" @click="remove"><Trash2 /> Supprimer</button>
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
  background: rgb(26 24 21 / 0.92);
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
  color: #ece6da;
}

.meta h2 {
  margin-top: var(--space-2);
  font-size: 34px;
  font-weight: 500;
  line-height: 1.1;
}

.sub {
  margin-top: var(--space-1);
  font: italic 500 19px var(--font-serif);
  color: #b9b1a3;
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
  color: #8f877a;
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
  color: #ece6da;
}

.actions .btn:hover {
  background: rgb(255 255 255 / 0.08);
  border-color: rgb(255 255 255 / 0.4);
}

.actions .btn-danger {
  color: #e2a397;
}

.close {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  color: #ece6da;
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
  color: #ece6da;
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

@media (max-width: 960px) {
  .stage {
    flex-direction: column;
    justify-content: center;
    gap: var(--space-4);
    padding: var(--space-5) var(--space-4);
  }
  .card-wrap {
    height: auto;
    width: min(80vw, 60vh);
  }
  .meta {
    width: min(80vw, 420px);
    text-align: center;
  }
  .meta dl {
    display: none;
  }
  .actions {
    justify-content: center;
  }
  .nav {
    top: auto;
    bottom: var(--space-4);
    translate: none;
  }
}
</style>
