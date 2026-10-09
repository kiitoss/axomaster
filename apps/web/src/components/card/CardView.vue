<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CARD_WIDTH,
  formatNumber,
  RARITY_INFO,
  type Card,
  type Category,
} from '@axomaster/card-model'
import { useImageUrl } from '@/composables/useImageUrl'
import CardLayer from './CardLayer.vue'

const props = withDefaults(
  defineProps<{
    card: Card
    category?: Category | null
    /** Effet 3D + reflet holographique au survol. */
    interactive?: boolean
  }>(),
  { category: null, interactive: false },
)

const root = ref<HTMLElement>()
const inner = ref<HTMLElement>()
const scale = ref(0)

let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (entry) scale.value = entry.contentRect.width / CARD_WIDTH
  })
  observer.observe(root.value!)
})
onBeforeUnmount(() => observer?.disconnect())

const rarity = computed(() => RARITY_INFO[props.card.rarity])
const photoUrl = useImageUrl(() => props.card.photo.imageId)

const initials = computed(
  () =>
    props.card.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?',
)

const nameSize = computed(() => {
  const length = props.card.name.length
  if (length > 26) return 32
  if (length > 20) return 38
  return 46
})

const photoStyle = computed(() => {
  const { x, y, scale } = props.card.photo
  return {
    objectPosition: `${x}% ${y}%`,
    transformOrigin: `${x}% ${y}%`,
    transform: scale !== 1 ? `scale(${scale})` : undefined,
  }
})

const year = computed(() => new Date(props.card.createdAt).getFullYear())

const tilt = ref({ rx: 0, ry: 0, mx: 50, my: 50, active: false })

/** Souris : suit le survol. Doigt : suit le doigt posé, puis la carte revient en douceur. */
function onPointerMove(e: PointerEvent) {
  if (!props.interactive) return
  const rect = root.value!.getBoundingClientRect()
  const px = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
  const py = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height))
  tilt.value = {
    rx: (0.5 - py) * 12,
    ry: (px - 0.5) * 16,
    mx: px * 100,
    my: py * 100,
    active: true,
  }
}

function onPointerLeave() {
  tilt.value = { rx: 0, ry: 0, mx: 50, my: 50, active: false }
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerType !== 'mouse') onPointerLeave()
}

const rootStyle = computed(() => ({
  '--rx': `${tilt.value.rx}deg`,
  '--ry': `${tilt.value.ry}deg`,
  '--mx': `${tilt.value.mx}%`,
  '--my': `${tilt.value.my}%`,
  '--rarity': rarity.value.color,
  '--holo': rarity.value.holo,
  '--frame': `linear-gradient(155deg, ${rarity.value.frame.join(', ')})`,
}))

defineExpose({ inner })
</script>

<template>
  <div
    ref="root"
    class="card"
    :class="[`rarity-${card.rarity}`, { interactive, active: tilt.active }]"
    :style="rootStyle"
    @pointerdown="onPointerMove"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
    @pointerup="onPointerUp"
    @pointercancel="onPointerLeave"
  >
    <div class="tilt">
      <div ref="inner" class="inner" :style="{ transform: `scale(${scale})` }">
        <div class="face">
          <header class="head">
            <h2 class="name" :style="{ fontSize: `${nameSize}px` }">
              {{ card.name || 'Sans titre' }}
            </h2>
            <span v-if="card.number != null" class="number"
              >Nº {{ formatNumber(card.number) }}</span
            >
          </header>

          <div class="photo">
            <img v-if="photoUrl" :src="photoUrl" :style="photoStyle" alt="" draggable="false" />
            <div v-else class="photo-empty">{{ initials }}</div>
            <span v-if="category" class="ribbon" :style="{ '--cat': category.color }">
              {{ category.name }}
            </span>
          </div>

          <div class="subtitle">
            <span class="rule" />
            <span class="subtitle-text">{{ card.subtitle || ' ' }}</span>
            <span class="rule" />
          </div>

          <p class="description">{{ card.description }}</p>

          <footer class="foot">
            <span class="pips" :aria-label="rarity.label">
              <i v-for="n in 5" :key="n" :class="{ on: n <= rarity.rank }" />
            </span>
            <span class="brand">AxoMaster</span>
            <span class="year">{{ rarity.label }} · {{ year }}</span>
          </footer>
        </div>

        <div class="layers">
          <CardLayer
            v-for="layer in card.layers"
            v-show="layer.visible"
            :key="layer.id"
            :layer="layer"
          />
        </div>

        <div class="holo" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
  width: 100%;
  aspect-ratio: 630 / 880;
  perspective: 1400px;
  user-select: none;
}

.tilt {
  position: absolute;
  inset: 0;
  border-radius: 4.6% / 3.3%;
  box-shadow:
    0 1px 2px rgb(15 23 42 / 0.12),
    0 8px 24px rgb(15 23 42 / 0.12);
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transition:
    transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1),
    box-shadow 0.3s;
  transform-style: preserve-3d;
}

.card.active .tilt {
  transition:
    transform 0.08s linear,
    box-shadow 0.3s;
  box-shadow:
    0 2px 4px rgb(15 23 42 / 0.12),
    0 20px 50px rgb(15 23 42 / 0.22);
}

.inner {
  position: absolute;
  top: 0;
  left: 0;
  width: 630px;
  height: 880px;
  transform-origin: 0 0;
  border-radius: 29px;
  background: var(--frame);
  overflow: hidden;
}

.face {
  position: absolute;
  inset: 16px;
  display: flex;
  flex-direction: column;
  padding: 22px 26px 16px;
  border-radius: 16px;
  background:
    radial-gradient(120% 80% at 50% 0%, rgb(255 255 255 / 0.65), transparent 70%), #fbfaff;
  box-shadow:
    inset 0 0 0 1px rgb(15 23 42 / 0.14),
    inset 0 0 0 6px #fbfaff,
    inset 0 0 0 7px color-mix(in srgb, var(--rarity) 55%, transparent);
  color: #0f172a;
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  height: 62px;
  padding: 2px 6px 0;
}

.name {
  font-family: var(--font-serif);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: 0.005em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.number {
  flex: none;
  font: 500 15px var(--font-sans);
  letter-spacing: 0.12em;
  color: var(--rarity);
}

.photo {
  position: relative;
  flex: none;
  height: 520px;
  border-radius: 6px;
  overflow: hidden;
  background: #e2e8f0;
  box-shadow:
    0 0 0 1px rgb(15 23 42 / 0.18),
    0 0 0 5px #fbfaff,
    0 0 0 6px color-mix(in srgb, var(--rarity) 45%, transparent);
  margin: 6px 6px 0;
}

.photo img {
  width: 100%;
  height: 100%;
  max-width: none;
  object-fit: cover;
}

.photo-empty {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  font: 500 140px var(--font-serif);
  color: rgb(15 23 42 / 0.18);
  background:
    repeating-linear-gradient(45deg, transparent 0 14px, rgb(15 23 42 / 0.03) 14px 15px),
    linear-gradient(160deg, #f1f5f9, #e2e8f0);
}

.ribbon {
  position: absolute;
  top: 16px;
  left: 0;
  padding: 7px 16px 7px 14px;
  background: rgb(251 250 255 / 0.94);
  border-left: 4px solid var(--cat);
  border-radius: 0 3px 3px 0;
  font: 600 13px var(--font-sans);
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #0f172a;
  box-shadow: 0 2px 8px rgb(15 23 42 / 0.12);
}

.subtitle {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 22px 6px 10px;
}

.rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--rarity));
}

.rule:last-child {
  background: linear-gradient(90deg, var(--rarity), transparent);
}

.subtitle-text {
  max-width: 80%;
  font: italic 500 26px var(--font-serif);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.description {
  flex: 1;
  margin: 0 10px;
  font: 400 17px/1.55 var(--font-sans);
  color: #475569;
  text-align: center;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.foot {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 12px 6px 0;
  border-top: 1px solid rgb(15 23 42 / 0.12);
  font: 500 12px var(--font-sans);
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #64748b;
}

.pips {
  display: flex;
  gap: 6px;
}

.pips i {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  border: 1px solid var(--rarity);
}

.pips i.on {
  background: var(--rarity);
}

.brand {
  font: 600 15px var(--font-serif);
  letter-spacing: 0.3em;
  color: #0f172a;
}

.year {
  text-align: right;
}

.layers {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.holo {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  opacity: calc(var(--holo) * 0.25);
  mix-blend-mode: soft-light;
  background:
    radial-gradient(circle at var(--mx) var(--my), rgb(255 255 255 / 0.9), transparent 42%),
    linear-gradient(
      115deg,
      transparent 15%,
      rgb(255 214 140 / 0.7) 35%,
      rgb(160 210 255 / 0.7) 50%,
      rgb(230 170 255 / 0.6) 62%,
      transparent 85%
    );
  background-size:
    100% 100%,
    250% 250%;
  background-position:
    center,
    var(--mx) var(--my);
  transition: opacity 0.4s;
}

.card.active .holo {
  opacity: calc(0.2 + var(--holo) * 0.8);
}

.rarity-legendary .inner::after {
  content: '';
  position: absolute;
  inset: 5px;
  border-radius: 25px;
  border: 1px solid rgb(255 245 210 / 0.8);
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .tilt {
    transform: none !important;
    transition: none;
  }
}
</style>
