<!-- Dos de carte. Dimensionné en unités de conteneur (cqw) pour suivre la largeur disponible. -->
<script setup lang="ts">
defineProps<{
  /** Texte discret en haut (numéro de la carte dans le catalogue). */
  label?: string
  /** Couleur de la collection, reprise par le liseré de l'emblème. */
  color?: string
}>()
</script>

<template>
  <div class="back" aria-hidden="true" :style="color ? { '--ring': color } : undefined">
    <div class="frame">
      <div class="pattern" />
      <span v-if="label" class="label">{{ label }}</span>
      <div class="emblem">
        <span class="diamond" />
      </div>
      <span class="brand">AxoMaster</span>
    </div>
  </div>
</template>

<style scoped>
.back {
  container-type: inline-size;
  position: relative;
  width: 100%;
  aspect-ratio: 630 / 880;
  border-radius: 4.6% / 3.3%;
  background: linear-gradient(155deg, #e9d59c, #a8832f 45%, #f1dc9e 70%, #8a6a24);
  overflow: hidden;
}

.frame {
  position: absolute;
  inset: 2.5cqw;
  display: grid;
  place-items: center;
  border-radius: 2.6cqw;
  background: radial-gradient(90% 70% at 50% 40%, #2d2a25, #1a1815 75%);
  box-shadow:
    inset 0 0 0 0.3cqw rgb(239 226 191 / 0.35),
    inset 0 0 0 1.6cqw #1a1815,
    inset 0 0 0 1.8cqw rgb(168 131 47 / 0.6);
  overflow: hidden;
}

.pattern {
  position: absolute;
  inset: 0;
  opacity: 0.5;
  background:
    repeating-linear-gradient(45deg, transparent 0 3.2cqw, rgb(168 131 47 / 0.12) 3.2cqw 3.4cqw),
    repeating-linear-gradient(-45deg, transparent 0 3.2cqw, rgb(168 131 47 / 0.12) 3.2cqw 3.4cqw);
  mask-image: radial-gradient(70% 55% at 50% 45%, transparent 30%, #000 75%);
}

.emblem {
  position: relative;
  display: grid;
  place-items: center;
  width: 34cqw;
  height: 34cqw;
  border: 0.4cqw solid var(--ring, rgb(168 131 47 / 0.8));
  border-radius: 50%;
  box-shadow:
    0 0 0 2cqw rgb(26 24 21 / 0.9),
    0 0 0 2.3cqw rgb(168 131 47 / 0.35),
    0 0 8cqw rgb(168 131 47 / 0.25);
}

.diamond {
  width: 13cqw;
  height: 13cqw;
  transform: rotate(45deg);
  background: linear-gradient(135deg, #f4e4b0, #a8832f 55%, #6f5520);
  box-shadow: 0 0 4cqw rgb(244 228 176 / 0.35);
}

.label {
  position: absolute;
  top: 8cqw;
  font: 600 6cqw var(--font-serif);
  letter-spacing: 0.12em;
  color: #d9c38a;
  font-variant-numeric: tabular-nums;
}

.brand {
  position: absolute;
  bottom: 9cqw;
  font: 600 4.6cqw var(--font-serif);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #d9c38a;
}
</style>
