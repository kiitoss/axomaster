<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import AxoX from '@/components/brand/AxoX.vue'

const props = withDefaults(
  defineProps<{
    title: string
    caption?: string
    color?: string
    /** Grand paquet de la scène : inclinaison au pointeur et déchirure au geste. */
    tearable?: boolean
  }>(),
  { caption: '', color: '#8b5cf6', tearable: false },
)

const emit = defineEmits<{ torn: [] }>()

const root = ref<HTMLElement>()
const tilt = ref({ rx: 0, ry: 0, mx: 50, my: 30 })
/** Progression de la déchirure, 0–1. */
const progress = ref(0)
/** Sens du geste : 1 de gauche à droite, -1 de droite à gauche. */
const direction = ref(1)
const dragging = ref(false)
const auto = ref(false)
const torn = ref(false)

let drag: { x: number; y: number; id: number; moved: boolean } | null = null
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

/** Au-delà de ce seuil, relâcher termine la déchirure. */
const TEAR_THRESHOLD = 0.6

function updateTilt(e: PointerEvent) {
  const rect = root.value!.getBoundingClientRect()
  const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
  tilt.value = { rx: (0.5 - py) * 10, ry: (px - 0.5) * 14, mx: px * 100, my: py * 100 }
}

function resetTilt() {
  tilt.value = { rx: 0, ry: 0, mx: 50, my: 30 }
}

function onPointerDown(e: PointerEvent) {
  if (!props.tearable || torn.value || auto.value) return
  root.value!.setPointerCapture(e.pointerId)
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
  dragging.value = true
}

function onPointerMove(e: PointerEvent) {
  if (!props.tearable || torn.value) return
  if (!drag || e.pointerId !== drag.id) {
    if (e.pointerType === 'mouse') updateTilt(e)
    return
  }
  const dx = e.clientX - drag.x
  if (!drag.moved && Math.abs(dx) < 6) return
  drag.moved = true
  direction.value = dx >= 0 ? 1 : -1
  const width = root.value!.getBoundingClientRect().width
  progress.value = Math.min(1, Math.abs(dx) / (width * 0.85))
  if (progress.value >= 1) finishTear()
}

function onPointerUp(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id) return
  const moved = drag.moved
  drag = null
  dragging.value = false
  if (torn.value) return
  if (!moved) autoTear()
  else if (progress.value >= TEAR_THRESHOLD) finishTear()
  else progress.value = 0
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse' && !drag) resetTilt()
}

/** Simple clic / tap : la déchirure se fait toute seule. */
function autoTear() {
  auto.value = true
  progress.value = 1
  timer = setTimeout(finishTear, 420)
}

function finishTear() {
  if (torn.value) return
  drag = null
  dragging.value = false
  progress.value = 1
  torn.value = true
  resetTilt()
  timer = setTimeout(() => emit('torn'), 650)
}

function onKey(e: KeyboardEvent) {
  if ((e.key === 'Enter' || e.key === ' ') && props.tearable && !torn.value && !auto.value) {
    e.preventDefault()
    autoTear()
  }
}

const style = computed(() => ({
  '--pack': props.color,
  '--rx': `${tilt.value.rx}deg`,
  '--ry': `${tilt.value.ry}deg`,
  '--mx': `${tilt.value.mx}%`,
  '--my': `${tilt.value.my}%`,
  '--p': progress.value,
  '--dir': direction.value,
}))
</script>

<template>
  <div
    ref="root"
    class="pack"
    :class="{ tearable, dragging, auto, torn, reverse: direction === -1 }"
    :style="style"
    :role="tearable ? 'button' : undefined"
    :tabindex="tearable ? 0 : undefined"
    :aria-label="tearable ? `Ouvrir le booster ${title}` : undefined"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerLeave"
    @keydown="onKey"
  >
    <div class="float">
      <div class="tilt">
        <div class="top">
          <span class="crimp" />
        </div>

        <div class="body">
          <span class="rip" />
          <span class="perforation" />
          <span class="tear-glow" />

          <div class="content">
            <span class="brand">AxoMaster</span>
            <span class="emblem"><AxoX gradient="light" /></span>
            <span class="title">{{ title }}</span>
            <span v-if="caption" class="caption">{{ caption }}</span>
          </div>

          <span class="crimp bottom" />
          <span class="sheen" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pack {
  --teeth: 1.6cqw;
  --top-h: 11%;
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 63 / 100;
  perspective: 1200px;
  user-select: none;
  -webkit-user-select: none;
}

.tearable {
  cursor: grab;
  touch-action: none;
}

.tearable.dragging {
  cursor: grabbing;
}

.tearable:focus-visible {
  outline: none;
}

.tearable:focus-visible .body {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}

.float {
  position: absolute;
  inset: 0;
}

.tearable .float {
  animation: float 4.5s ease-in-out infinite;
}

@keyframes float {
  50% {
    transform: translateY(-1.8cqw) rotate(-0.6deg);
  }
}

.tilt {
  position: absolute;
  inset: 0;
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1);
  filter: drop-shadow(0 3cqw 5cqw rgb(0 0 0 / 0.35));
}

.tearable:not(.torn):hover .tilt {
  transition-duration: 0.12s;
}

/* Feuille métallisée commune au haut et au corps. */
.top,
.body {
  position: absolute;
  left: 0;
  right: 0;
  background:
    repeating-linear-gradient(90deg, rgb(255 255 255 / 0.04) 0 0.4cqw, transparent 0.4cqw 1.2cqw),
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--pack) 55%, #fff) 0%,
      var(--pack) 30%,
      color-mix(in srgb, var(--pack) 55%, #0f172a) 62%,
      color-mix(in srgb, var(--pack) 80%, #fff) 82%,
      color-mix(in srgb, var(--pack) 60%, #0f172a) 100%
    );
}

/* ---------- Bande du haut (celle qu'on arrache) ---------- */

.top {
  top: 0;
  height: var(--top-h);
  background-size:
    auto,
    100% 909%;
  background-position: 0 0;
  /* Dents de scie sur le bord supérieur. */
  mask:
    conic-gradient(from 135deg at top, #0000, #000 1deg 89deg, #0000 90deg) 0 0 /
      calc(2 * var(--teeth)) var(--teeth) repeat-x,
    linear-gradient(#000 0 0) 0 var(--teeth) / 100% 100% no-repeat;
  transform-origin: calc(50% - var(--dir) * 50%) 100%;
  transform: translateY(calc(var(--p) * -1.2cqw)) rotate(calc(var(--p) * var(--dir) * -5deg));
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.dragging .top {
  transition: none;
}

.auto .top {
  transition-duration: 0.42s;
  transition-timing-function: ease-in;
}

.torn .top {
  animation: fly-off 0.7s cubic-bezier(0.3, 0, 0.7, 1) forwards;
}

@keyframes fly-off {
  from {
    transform: translateY(-1.2cqw) rotate(calc(var(--dir) * -5deg));
  }
  30% {
    transform: translate(calc(var(--dir) * 8cqw), -10cqw) rotate(calc(var(--dir) * 14deg));
    opacity: 1;
  }
  to {
    transform: translate(calc(var(--dir) * 60cqw), 40cqw) rotate(calc(var(--dir) * 70deg));
    opacity: 0;
  }
}

/* Plissage du sertissage : fines nervures verticales. */
.crimp {
  position: absolute;
  inset: var(--teeth) 0 auto;
  height: 4cqw;
  background: repeating-linear-gradient(
    90deg,
    rgb(255 255 255 / 0.18) 0 0.35cqw,
    rgb(0 0 0 / 0.14) 0.35cqw 0.9cqw
  );
}

/* ---------- Corps du paquet ---------- */

.body {
  top: var(--top-h);
  bottom: 0;
  background-size:
    auto,
    100% 112.4%;
  background-position: 0 100%;
  overflow: hidden;
  mask:
    conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg) 0 100% /
      calc(2 * var(--teeth)) var(--teeth) repeat-x,
    linear-gradient(#000 0 0) 0 0 / 100% calc(100% - var(--teeth)) no-repeat;
}

.torn .body {
  animation: shake 0.45s ease-out;
}

@keyframes shake {
  20% {
    transform: translateX(-1cqw) rotate(-1deg);
  }
  45% {
    transform: translateX(0.8cqw) rotate(0.8deg);
  }
  70% {
    transform: translateX(-0.4cqw);
  }
}

.crimp.bottom {
  inset: auto 0 var(--teeth);
}

.perforation {
  position: absolute;
  top: 0.6cqw;
  left: 0;
  right: 0;
  height: 0.4cqw;
  background: repeating-linear-gradient(
    90deg,
    rgb(255 255 255 / 0.45) 0 1cqw,
    transparent 1cqw 2cqw
  );
  transition: opacity 0.3s;
}

/* Ligne lumineuse qui suit la déchirure. */
.tear-glow {
  position: absolute;
  top: 0.4cqw;
  left: 0;
  height: 0.8cqw;
  width: calc(var(--p) * 100%);
  background: linear-gradient(90deg, rgb(245 243 255 / 0.6), #fff);
  box-shadow:
    0 0 2cqw 0.6cqw rgb(221 214 254 / 0.8),
    0 0 6cqw 1cqw rgb(167 139 250 / 0.45);
  border-radius: 1cqw;
  opacity: min(1, calc(var(--p) * 4));
  transition: width 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.reverse .tear-glow {
  left: auto;
  right: 0;
}

.dragging .tear-glow {
  transition: none;
}

.auto .tear-glow {
  transition-duration: 0.42s;
  transition-timing-function: ease-in;
}

/* Bord déchiré, révélé quand la bande est partie. */
.rip {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2.2cqw;
  background: #f5f3ff;
  clip-path: polygon(
    0 0,
    100% 0,
    100% 60%,
    94% 30%,
    88% 75%,
    81% 40%,
    73% 85%,
    66% 35%,
    58% 70%,
    50% 25%,
    43% 80%,
    35% 45%,
    27% 90%,
    20% 35%,
    12% 70%,
    6% 30%,
    0 65%
  );
  opacity: 0;
}

.torn .rip {
  opacity: 1;
}

.torn .perforation,
.torn .tear-glow {
  opacity: 0;
  transition: opacity 0.4s 0.2s;
}

.content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4cqw;
  padding: 10cqw 8cqw;
  text-align: center;
  color: #fff;
  text-shadow: 0 0.3cqw 1.2cqw rgb(0 0 0 / 0.35);
}

.brand {
  font: 700 4.4cqw var(--font-display);
  letter-spacing: 0.42em;
  text-transform: uppercase;
  padding-left: 0.42em;
}

.emblem {
  display: grid;
  place-items: center;
  width: 30cqw;
  height: 30cqw;
  border-radius: 50%;
  border: 0.5cqw solid rgb(255 255 255 / 0.7);
  box-shadow:
    0 0 0 2cqw rgb(0 0 0 / 0.12),
    0 0 0 2.4cqw rgb(255 255 255 / 0.3),
    inset 0 0 6cqw rgb(255 255 255 / 0.25);
}

.emblem .axo-x {
  width: 13cqw;
  filter: drop-shadow(0 0 2.4cqw rgb(237 233 254 / 0.7));
}

.title {
  font: 700 10cqw/1.05 var(--font-display);
  letter-spacing: -0.025em;
  overflow-wrap: anywhere;
}

.caption {
  font: 500 3.6cqw var(--font-sans);
  letter-spacing: 0.24em;
  text-transform: uppercase;
  opacity: 0.85;
}

/* Reflet qui suit le pointeur. */
.sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  mix-blend-mode: overlay;
  background:
    radial-gradient(circle at var(--mx) var(--my), rgb(255 255 255 / 0.75), transparent 45%),
    linear-gradient(
      115deg,
      transparent 20%,
      rgb(255 255 255 / 0.45) 40%,
      transparent 48%,
      rgb(255 255 255 / 0.25) 58%,
      transparent 70%
    );
  background-size:
    100% 100%,
    250% 250%;
  background-position:
    center,
    var(--mx) var(--my);
}

.pack:not(.tearable) .sheen {
  animation: sheen 6s ease-in-out infinite;
}

@keyframes sheen {
  0%,
  100% {
    background-position:
      center,
      0% 0%;
  }
  50% {
    background-position:
      center,
      100% 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tearable .float,
  .pack:not(.tearable) .sheen,
  .torn .body {
    animation: none;
  }

  .tilt {
    transform: none;
  }

  .torn .top {
    animation: none;
    opacity: 0;
    transition: opacity 0.3s;
  }
}
</style>
