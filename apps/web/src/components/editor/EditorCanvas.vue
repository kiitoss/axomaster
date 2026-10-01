<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import type { Layer } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useEditor } from '@/composables/editor'
import CardView from '@/components/card/CardView.vue'

const store = useCardsStore()
const { draft, selected } = useEditor()

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

/** Suit le pointeur et fournit le déplacement en % de la carte. */
function track(e: PointerEvent, onMove: (dx: number, dy: number, ev: PointerEvent) => void) {
  const rect = overlay.value!.getBoundingClientRect()
  const startX = e.clientX
  const startY = e.clientY
  const move = (ev: PointerEvent) =>
    onMove(((ev.clientX - startX) / rect.width) * 100, ((ev.clientY - startY) / rect.height) * 100, ev)
  const up = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    guides.v = guides.h = false
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', up)
}

const SNAP = 1.2

function startMove(e: PointerEvent, layer: Layer) {
  if (e.button !== 0) return
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
    else if (Math.abs(angle % 90) < 3 || Math.abs(angle % 90) > 87) angle = Math.round(angle / 90) * 90
    layer.rotation = Math.round(angle)
  })
}

function photoRect() {
  return view.value?.$el.querySelector('.photo')?.getBoundingClientRect() as DOMRect | undefined
}

/** Clic hors calque : sélectionne la photo (et permet de la recadrer) ou la carte. */
function onBackgroundDown(e: PointerEvent) {
  if (e.button !== 0) return
  const rect = photoRect()
  const inPhoto =
    rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom
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
    <div class="canvas">
      <CardView ref="view" :card="draft" :category="category" />
      <div
        ref="overlay"
        class="overlay"
        :class="{ 'photo-mode': selected === 'photo' && draft.photo.imageId }"
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
            <span class="rotate" title="Rotation (Maj : par 15°)" @pointerdown.stop="startRotate($event, layer)" />
          </template>
        </div>
        <div v-show="guides.v" class="guide vertical" />
        <div v-show="guides.h" class="guide horizontal" />
      </div>
    </div>
    <p class="hint">
      <template v-if="selected === 'photo'">Glissez pour recadrer la photo · molette pour zoomer</template>
      <template v-else>Maj : garder les proportions · Alt : désactiver le magnétisme · Suppr : effacer</template>
    </p>
  </div>
</template>

<style scoped>
.stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  height: 100%;
  padding: var(--space-6);
  background:
    radial-gradient(circle at 1px 1px, var(--line) 1px, transparent 0) 0 0 / 22px 22px,
    var(--paper-2);
  overflow: hidden;
}

.canvas {
  position: relative;
  height: min(calc(100vh - var(--header-h) - 140px), 880px);
  aspect-ratio: 630 / 880;
  max-width: 100%;
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
  outline-color: rgb(168 131 47 / 0.6);
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

.handle.nw { left: 0; top: 0; cursor: nwse-resize; }
.handle.n { left: 50%; top: 0; cursor: ns-resize; }
.handle.ne { left: 100%; top: 0; cursor: nesw-resize; }
.handle.e { left: 100%; top: 50%; cursor: ew-resize; }
.handle.se { left: 100%; top: 100%; cursor: nwse-resize; }
.handle.s { left: 50%; top: 100%; cursor: ns-resize; }
.handle.sw { left: 0; top: 100%; cursor: nesw-resize; }
.handle.w { left: 0; top: 50%; cursor: ew-resize; }

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
  font-size: 12px;
  color: var(--ink-3);
}
</style>
