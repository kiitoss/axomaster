<script setup lang="ts">
import { computed } from 'vue'
import { RARITY_INFO, type Card, type Category } from '@axomaster/card-model'
import CardView from '@/components/card/CardView.vue'
import CardBack from './CardBack.vue'

const props = defineProps<{
  card: Card
  category: Category | null
  /** Carte retournée, recto visible. */
  flipped: boolean
  /** Montée en tension avant le retournement (épique et légendaire). */
  charging?: boolean
  /** Carte au sommet de la pile : seule celle-ci affiche ses effets. */
  active?: boolean
}>()

const rarity = computed(() => RARITY_INFO[props.card.rarity])
const premium = computed(() => rarity.value.rank >= RARITY_INFO.rare.rank)
const majestic = computed(() => rarity.value.rank >= RARITY_INFO.epic.rank)

/** Éclats : trajectoires tirées une fois par carte. */
const sparks = computed(() => {
  const count = props.card.rarity === 'legendary' ? 34 : majestic.value ? 24 : 14
  return Array.from({ length: count }, (_, i) => ({
    '--a': `${(360 / count) * i + Math.random() * 20}deg`,
    '--d': `${45 + Math.random() * 45}cqw`,
    '--s': `${0.8 + Math.random() * 1.6}cqw`,
    '--t': `${0.7 + Math.random() * 0.6}s`,
  }))
})
</script>

<template>
  <div
    class="reveal"
    :class="[`rarity-${card.rarity}`, { flipped, charging, active, premium, majestic }]"
    :style="{ '--rarity': rarity.color }"
  >
    <div v-if="flipped && active" class="fx" aria-hidden="true">
      <span class="halo" />
      <span v-if="majestic" class="rays" />
      <template v-if="premium">
        <i v-for="(spark, i) in sparks" :key="i" class="spark" :style="spark" />
      </template>
    </div>

    <div class="flipper">
      <div class="face back">
        <CardBack />
        <span class="charge" />
      </div>
      <div class="face front">
        <CardView :card="card" :category="category" :interactive="flipped && active" />
        <span v-if="majestic" class="sweep" />
      </div>
    </div>

    <p class="label" :aria-hidden="!flipped">
      <span class="pips"><i v-for="n in 5" :key="n" :class="{ on: n <= rarity.rank }" /></span>
      {{ rarity.label }}
    </p>
  </div>
</template>

<style scoped>
.reveal {
  --flip: 0.75s;
  --soft: color-mix(in srgb, var(--rarity) 55%, #fff);
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 630 / 880;
}

/* ---------- Retournement ---------- */

.flipper {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform var(--flip) cubic-bezier(0.3, 1.25, 0.4, 1);
}

.flipped .flipper {
  transform: rotateY(180deg);
}

.face {
  position: absolute;
  inset: 0;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  border-radius: 4.6% / 3.3%;
}

.back {
  box-shadow: 0 2cqw 6cqw rgb(0 0 0 / 0.45);
}

.front {
  transform: rotateY(180deg);
}

/* Tremblement et lueur montante avant une carte épique ou légendaire. */
.charging .flipper {
  animation: charge-shake 0.7s ease-in both;
}

@keyframes charge-shake {
  0%,
  100% {
    transform: none;
  }
  10%,
  30%,
  50%,
  70%,
  90% {
    transform: translateX(-0.8cqw) rotate(-0.6deg) scale(1.01);
  }
  20%,
  40%,
  60%,
  80% {
    transform: translateX(0.8cqw) rotate(0.6deg) scale(1.02);
  }
}

.charge {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  box-shadow:
    0 0 4cqw 1cqw var(--soft),
    inset 0 0 8cqw 2cqw color-mix(in srgb, var(--rarity) 70%, transparent);
  transition: opacity 0.7s ease-in;
}

.charging .charge {
  opacity: 1;
}

/* ---------- Effets du recto ---------- */

.fx {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.halo {
  position: absolute;
  inset: -18%;
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--soft), transparent);
  opacity: 0;
  animation: halo 1.2s calc(var(--flip) * 0.4) ease-out forwards;
}

.premium .halo {
  animation:
    halo 1.2s calc(var(--flip) * 0.4) ease-out forwards,
    pulse 2.8s 1.6s ease-in-out infinite;
}

@keyframes halo {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
  35% {
    opacity: 0.95;
  }
  to {
    opacity: 0.45;
    transform: scale(1);
  }
}

@keyframes pulse {
  50% {
    opacity: 0.65;
    transform: scale(1.05);
  }
}

.rays {
  position: absolute;
  inset: -55%;
  border-radius: 50%;
  background: repeating-conic-gradient(
    from 0deg,
    color-mix(in srgb, var(--soft) 70%, transparent) 0deg 5deg,
    transparent 5deg 18deg
  );
  mask: radial-gradient(closest-side, #000 25%, transparent 100%);
  opacity: 0;
  animation:
    rays-in 0.9s calc(var(--flip) * 0.4) ease-out forwards,
    spin 22s linear infinite;
}

.rarity-legendary .rays {
  background: repeating-conic-gradient(
    from 0deg,
    rgb(255 236 180 / 0.75) 0deg 4deg,
    transparent 4deg 12deg,
    rgb(255 214 140 / 0.35) 12deg 14deg,
    transparent 14deg 22deg
  );
}

@keyframes rays-in {
  from {
    opacity: 0;
    scale: 0.3;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}

@keyframes spin {
  to {
    rotate: 360deg;
  }
}

.spark {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--s);
  height: var(--s);
  margin: calc(var(--s) / -2);
  transform: rotate(45deg);
  background: #fff;
  box-shadow:
    0 0 1.5cqw var(--soft),
    0 0 3cqw var(--rarity);
  opacity: 0;
  animation: spark var(--t) calc(var(--flip) * 0.45) cubic-bezier(0.1, 0.7, 0.3, 1) forwards;
}

.spark:nth-child(3n) {
  background: var(--soft);
}

@keyframes spark {
  from {
    opacity: 1;
    transform: rotate(var(--a)) translateX(10cqw) rotate(45deg) scale(1);
  }
  70% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: rotate(var(--a)) translateX(var(--d)) rotate(45deg) scale(0.2);
  }
}

/* Reflet holographique qui balaie la carte une fois retournée. */
.sweep {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  mix-blend-mode: overlay;
  background: linear-gradient(
    110deg,
    transparent 30%,
    rgb(255 255 255 / 0.85) 45%,
    rgb(255 220 150 / 0.6) 50%,
    rgb(170 210 255 / 0.5) 55%,
    transparent 70%
  );
  background-size: 300% 100%;
  background-position: 120% 0;
}

.flipped.active .sweep {
  animation: sweep 1.4s calc(var(--flip) * 0.6) ease-in-out;
}

.flipped.active.rarity-legendary .sweep {
  animation: sweep 1.4s calc(var(--flip) * 0.6) ease-in-out 3;
}

@keyframes sweep {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -20% 0;
  }
}

/* ---------- Libellé de rareté ---------- */

.label {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.6cqw;
  margin-top: 4cqw;
  font: 600 7.5cqw/1 var(--font-serif);
  letter-spacing: 0.08em;
  color: var(--soft);
  text-shadow: 0 0 4cqw color-mix(in srgb, var(--rarity) 60%, transparent);
  opacity: 0;
  transform: translateY(2cqw);
  transition:
    opacity 0.4s,
    transform 0.4s;
}

.flipped.active .label {
  opacity: 1;
  transform: none;
  transition-delay: calc(var(--flip) * 0.6);
}

.pips {
  display: flex;
  gap: 1.4cqw;
}

.pips i {
  width: 1.8cqw;
  height: 1.8cqw;
  transform: rotate(45deg);
  border: 1px solid var(--soft);
}

.pips i.on {
  background: var(--soft);
}

@media (prefers-reduced-motion: reduce) {
  .flipper {
    transition: none;
  }

  .charging .flipper {
    animation: none;
  }

  .rays,
  .spark,
  .sweep {
    display: none;
  }

  .halo {
    animation: none;
    opacity: 0.45;
  }
}
</style>
