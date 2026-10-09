<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import type { Layer } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useEditor } from '@/composables/editor'
import CardView from '@/components/card/CardView.vue'

const store = useCardsStore()
const { draft, selected, selectedLayer } = useEditor()
const touch = window.matchMedia('(pointer: coarse)').matches

const overlay = ref<HTMLElement>()
const view = ref<InstanceType<typeof CardView>>()
const category = computed(() => store.getCategory(draft.value.categoryId))
const guides = reactive({ v: false, h: false })

type Handle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const round = (n: number) => Math.round(n * 10) / 10

function boxStyle(l: Layer) {
  return {
    left: `${l.x}%`,
    top: `${l.y}%`,
    width: `${l.w}%`,
    height: `${l.h}%`,
    transform: l.rotation ? `rotate(${l.rotation}deg)` : undefined,
  }
}

// ---------- Gestes : un doigt = glisser, deux doigts = pincer ----------

/** Pointeurs actuellement posés sur la carte. */
const pointers = new Map<number, { x: number; y: number }>()
/** Incrémenté au début d'un pincement : interrompt le glisser en cours. */
let gesture = 0
let pinch: { distance: number; apply: (ratio: number) => void } | null = null

function distance() {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}

function onPointerDownCapture(e: PointerEvent) {
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 2) startPinch()
}

function startPinch() {
  gesture++
  guides.v = guides.h = false
  const layer = selectedLayer.value
  if (layer && !layer.locked) {
    const o = { x: layer.x, y: layer.y, w: layer.w, h: layer.h }
    pinch = {
      distance: distance(),
      apply: (r) => {
        const w = Math.max(1, o.w * r)
        const h = Math.max(0.5, o.h * r)
        Object.assign(layer, {
          w: round(w),
          h: round(h),
          x: round(o.x + (o.w - w) / 2),
          y: round(o.y + (o.h - h) / 2),
        })
      },
    }
  } else if (draft.value.photo.imageId) {
    selected.value = 'photo'
    const photo = draft.value.photo
    const scale = photo.scale
    pinch = {
      distance: distance(),
      apply: (r) => (photo.scale = Math.round(Math.min(5, Math.max(1, scale * r)) * 100) / 100),
    }
  }
}

function onWindowPointerMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pinch && pointers.size === 2 && pinch.distance > 0) pinch.apply(distance() / pinch.distance)
}

function onWindowPointerUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  if (pointers.size < 2) pinch = null
}

onMounted(() => {
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
})

/** Suit le pointeur et fournit le déplacement en % de la carte. */
function track(e: PointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void) {
  // Deuxième doigt : c'est un pincement, pas un nouveau glisser.
  if (pointers.size > 1) return
  const token = gesture
  const rect = overlay.value!.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId || token !== gesture) return
    onMove(
      ((ev.clientX - startX) / rect.width) * 100,
      ((ev.clientY - startY) / rect.height) * 100,
      ev,
    )
  }
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== e.pointerId) return
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    guides.v = guides.h = false
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
  window.addEventListener('pointercancel', up)
}

const SNAP = 1.2

function startMove(e: PointerEvent, layer: Layer) {
  if (e.button !== 0 || pointers.size > 1) return
  selected.value = layer.id
  if (layer.locked) return
  const origin = { x: layer.x, y: layer.y }
  track(e, (dx, dy, ev) => {
    let x = origin.x + dx
    let y = origin.y + dy
    guides.v = guides.h = false
    if (!ev.altKey) {
      if (Math.abs(x + layer.w / 2 - 50) < SNAP) {
        x = 50 - layer.w / 2
        guides.v = true
      }
      if (Math.abs(y + layer.h / 2 - 50) < SNAP) {
        y = 50 - layer.h / 2
        guides.h = true
      }
    }
    layer.x = round(x)
    layer.y = round(y)
  })
}

function startResize(e: PointerEvent, layer: Layer, handle: Handle) {
  const o = { x: layer.x, y: layer.y, w: layer.w, h: layer.h }
  const ratio = o.w / o.h
  track(e, (dx, dy, ev) => {
    let { x, y, w, h } = o
    if (handle.includes('e')) w = o.w + dx
    if (handle.includes('w')) w = o.w - dx
    if (handle.includes('s')) h = o.h + dy
    if (handle.includes('n')) h = o.h - dy
    if (ev.shiftKey && handle.length === 2) h = w / ratio
    w = Math.max(1, w)
    h = Math.max(layer.type === 'shape' && layer.shape === 'line' ? 0.5 : 1, h)
    if (handle.includes('w')) x = o.x + o.w - w
    if (handle.includes('n')) y = o.y + o.h - h
    Object.assign(layer, { x: round(x), y: round(y), w: round(w), h: round(h) })
  })
}

function startRotate(e: PointerEvent, layer: Layer) {
  const rect = overlay.value!.getBoundingClientRect()
  const cx = rect.left + ((layer.x + layer.w / 2) / 100) * rect.width
  const cy = rect.top + ((layer.y + layer.h / 2) / 100) * rect.height
  track(e, (_dx, _dy, ev) => {
    let angle = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90
    if (angle > 180) angle -= 360
    if (ev.shiftKey) angle = Math.round(angle / 15) * 15
    else if (Math.abs(angle % 90) < 3 || Math.abs(angle % 90) > 87)
      angle = Math.round(angle / 90) * 90
    layer.rotation = Math.round(angle)
  })
}

function photoRect() {
  return view.value?.$el.querySelector('.photo')?.getBoundingClientRect() as DOMRect | undefined
}

/** Clic hors calque : sélectionne la photo (et permet de la recadrer) ou la carte. */
function onBackgroundDown(e: PointerEvent) {
  if (e.button !== 0 || pointers.size > 1) return
  const rect = photoRect()
  const inPhoto =
    rect &&
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom
  if (!inPhoto || !draft.value.photo.imageId) {
    selected.value = inPhoto ? 'photo' : 'card'
    return
  }
  selected.value = 'photo'
  const photo = draft.value.photo
  const origin = { x: photo.x, y: photo.y }
  const overlayRect = overlay.value!.getBoundingClientRect()
  const sx = overlayRect.width / rect.width
  const sy = overlayRect.height / rect.height
  track(e, (dx, dy) => {
    const factor = 1.6 / photo.scale
    photo.x = round(Math.min(100, Math.max(0, origin.x - dx * sx * factor)))
    photo.y = round(Math.min(100, Math.max(0, origin.y - dy * sy * factor)))
  })
}

defineExpose({ getInner: () => view.value?.inner })

function onWheel(e: WheelEvent) {
  if (selected.value !== 'photo' || !draft.value.photo.imageId) return
  e.preventDefault()
  const photo = draft.value.photo
  photo.scale = Math.round(Math.min(5, Math.max(1, photo.scale - e.deltaY * 0.002)) * 100) / 100
}
</script>

<template>
  <div class="stage" @pointerdown.self="selected = 'card'">
    <div class="fit" @pointerdown.self="selected = 'card'">
      <div class="canvas">
        <CardView ref="view" :card="draft" :category="category" />
        <div
          ref="overlay"
          class="overlay"
          :class="{ 'photo-mode': selected === 'photo' && draft.photo.imageId }"
          @pointerdown.capture="onPointerDownCapture"
          @pointerdown="onBackgroundDown"
          @wheel="onWheel"
        >
          <div
            v-for="layer in draft.layers"
            v-show="layer.visible"
            :key="layer.id"
            class="box"
            :class="{ selected: layer.id === selected, locked: layer.locked }"
            :style="boxStyle(layer)"
            @pointerdown.stop="startMove($event, layer)"
          >
            <template v-if="layer.id === selected && !layer.locked">
              <span
                v-for="h in HANDLES"
                :key="h"
                class="handle"
                :class="h"
                @pointerdown.stop="startResize($event, layer, h)"
              />
              <span
                class="rotate"
                title="Rotation (Maj : par 15°)"
                @pointerdown.stop="startRotate($event, layer)"
              />
            </template>
          </div>
          <div v-show="guides.v" class="guide vertical" />
          <div v-show="guides.h" class="guide horizontal" />
        </div>
      </div>
    </div>
    <p class="hint">
      <template v-if="touch">
        <template v-if="selected === 'photo'">Glissez pour recadrer · pincez pour zoomer</template>
        <template v-else-if="selectedLayer">
          Glissez pour déplacer · pincez pour redimensionner
        </template>
        <template v-else>Touchez la photo ou un calque pour le modifier</template>
      </template>
      <template v-else-if="selected === 'photo'">
        Glissez pour recadrer la photo · molette pour zoomer
      </template>
      <template v-else>
        Maj : garder les proportions · Alt : désactiver le magnétisme · Suppr : effacer
      </template>
    </p>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-6) var(--space-6) var(--space-4);
  background:
    radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0) 0 0 / 22px 22px,
    var(--paper-2);
  overflow: hidden;
}

/* Zone disponible : la carte s'y inscrit au plus grand en gardant ses proportions. */
.fit {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: grid;
  place-items: center;
  container-type: size;
}

.canvas {
  position: relative;
  width: min(100cqw, 100cqh * 630 / 880, 630px);
  aspect-ratio: 630 / 880;
}

.overlay {
  position: absolute;
  inset: 0;
  touch-action: none;
}

.overlay.photo-mode {
  cursor: grab;
}

.overlay.photo-mode:active {
  cursor: grabbing;
}

.box {
  position: absolute;
  cursor: move;
  outline: 1px dashed transparent;
}

.box:hover {
  outline-color: rgb(139 92 246 / 0.7);
}

.box.selected {
  outline: 1.5px solid var(--accent);
}

.box.locked {
  cursor: default;
  pointer-events: none;
}

.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid var(--accent);
  border-radius: 2px;
  translate: -50% -50%;
}

.handle.nw {
  left: 0;
  top: 0;
  cursor: nwse-resize;
}
.handle.n {
  left: 50%;
  top: 0;
  cursor: ns-resize;
}
.handle.ne {
  left: 100%;
  top: 0;
  cursor: nesw-resize;
}
.handle.e {
  left: 100%;
  top: 50%;
  cursor: ew-resize;
}
.handle.se {
  left: 100%;
  top: 100%;
  cursor: nwse-resize;
}
.handle.s {
  left: 50%;
  top: 100%;
  cursor: ns-resize;
}
.handle.sw {
  left: 0;
  top: 100%;
  cursor: nesw-resize;
}
.handle.w {
  left: 0;
  top: 50%;
  cursor: ew-resize;
}

.rotate {
  position: absolute;
  left: 50%;
  top: -28px;
  width: 12px;
  height: 12px;
  translate: -50% 0;
  border: 1.5px solid var(--accent);
  border-radius: 50%;
  background: #fff;
  cursor: grab;
}

.rotate::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 100%;
  width: 1px;
  height: 15px;
  background: var(--accent);
}

.guide {
  position: absolute;
  background: #d0457a;
  pointer-events: none;
}

.guide.vertical {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
}

.guide.horizontal {
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
}

.hint {
  flex: none;
  font-size: 12px;
  color: var(--ink-3);
  text-align: center;
}

/* Au doigt : poignées d'angle plus grandes, poignées latérales masquées. */
@media (pointer: coarse) {
  .handle {
    width: 20px;
    height: 20px;
    border-width: 2px;
    border-radius: 50%;
  }

  .handle.n,
  .handle.s,
  .handle.e,
  .handle.w {
    display: none;
  }

  .rotate {
    top: -44px;
    width: 24px;
    height: 24px;
    border-width: 2px;
  }

  .rotate::after {
    height: 20px;
  }
}

@media (max-width: 860px) {
  .stage {
    padding: var(--space-4) var(--space-4) var(--space-2);
    gap: var(--space-2);
  }

  .hint {
    font-size: 11px;
  }
}
</style>
