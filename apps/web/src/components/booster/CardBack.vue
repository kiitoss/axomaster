<!-- Dos de carte. Dimensionné en unités de conteneur (cqw) pour suivre la largeur disponible. -->
<script setup lang="ts">
import AxoX from '@/components/brand/AxoX.vue'

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
        <AxoX gradient="violet" />
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
  background: linear-gradient(155deg, #c4b5fd, #7c3aed 40%, #a78bfa 68%, #4c1d95);
  overflow: hidden;
}

.frame {
  position: absolute;
  inset: 2.5cqw;
  display: grid;
  place-items: center;
  border-radius: 2.6cqw;
  background:
    radial-gradient(70% 50% at 50% 46%, rgb(109 40 217 / 0.35), transparent 70%),
    radial-gradient(90% 70% at 50% 40%, #1e1b4b, #0f172a 75%);
  box-shadow:
    inset 0 0 0 0.3cqw rgb(237 233 254 / 0.3),
    inset 0 0 0 1.6cqw #0f172a,
    inset 0 0 0 1.8cqw rgb(167 139 250 / 0.55);
  overflow: hidden;
}

/* Motif de petits X en filigrane, effacé au centre. */
.pattern {
  position: absolute;
  inset: 0;
  opacity: 0.14;
  background: url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='60'%20height='60'%20viewBox='0%200%2060%2060'%3E%3Cg%20fill='%23a78bfa'%3E%3Cpath%20transform='translate(4.75%206)%20scale(.5)'%20d='M0.04%200.24C0.04%202.751%201.43%205.125%203.028%207.174C4.289%208.792%205.859%2010.426%207.442%2012.009C5.86%2013.59%204.293%2015.222%203.033%2016.838C1.435%2018.887%200.045%2021.261%200.045%2023.772H3.986C3.986%2022.646%204.653%2021.169%206.141%2019.261C7.262%2017.822%208.688%2016.336%2010.241%2014.784C11.793%2016.336%2013.219%2017.822%2014.34%2019.261C15.828%2021.169%2016.495%2022.646%2016.495%2023.772H20.436C20.436%2021.261%2019.046%2018.887%2017.448%2016.838C16.188%2015.222%2014.621%2013.59%2013.039%2012.009C14.622%2010.426%2016.192%208.792%2017.453%207.174C19.051%205.125%2020.441%202.751%2020.441%200.24H16.5C16.5%201.366%2015.833%202.843%2014.346%204.751C13.223%206.191%2011.795%207.679%2010.241%209.233C8.686%207.679%207.258%206.191%206.135%204.751C4.648%202.843%203.981%201.366%203.981%200.24H0.04Z'/%3E%3Cpath%20transform='translate(34.75%2036)%20scale(.5)'%20d='M0.04%200.24C0.04%202.751%201.43%205.125%203.028%207.174C4.289%208.792%205.859%2010.426%207.442%2012.009C5.86%2013.59%204.293%2015.222%203.033%2016.838C1.435%2018.887%200.045%2021.261%200.045%2023.772H3.986C3.986%2022.646%204.653%2021.169%206.141%2019.261C7.262%2017.822%208.688%2016.336%2010.241%2014.784C11.793%2016.336%2013.219%2017.822%2014.34%2019.261C15.828%2021.169%2016.495%2022.646%2016.495%2023.772H20.436C20.436%2021.261%2019.046%2018.887%2017.448%2016.838C16.188%2015.222%2014.621%2013.59%2013.039%2012.009C14.622%2010.426%2016.192%208.792%2017.453%207.174C19.051%205.125%2020.441%202.751%2020.441%200.24H16.5C16.5%201.366%2015.833%202.843%2014.346%204.751C13.223%206.191%2011.795%207.679%2010.241%209.233C8.686%207.679%207.258%206.191%206.135%204.751C4.648%202.843%203.981%201.366%203.981%200.24H0.04Z'/%3E%3C/g%3E%3C/svg%3E")
    center / 16cqw 16cqw;
  mask-image: radial-gradient(70% 55% at 50% 45%, transparent 30%, #000 75%);
}

.emblem {
  position: relative;
  display: grid;
  place-items: center;
  width: 36cqw;
  height: 36cqw;
  border: 0.4cqw solid var(--ring, rgb(167 139 250 / 0.85));
  border-radius: 50%;
  background: radial-gradient(circle, rgb(139 92 246 / 0.22), transparent 70%);
  box-shadow:
    0 0 0 2cqw rgb(15 23 42 / 0.9),
    0 0 0 2.3cqw rgb(167 139 250 / 0.35),
    0 0 9cqw rgb(139 92 246 / 0.35);
}

.emblem .axo-x {
  width: 15cqw;
  filter: drop-shadow(0 0 2.5cqw rgb(167 139 250 / 0.65));
}

.label {
  position: absolute;
  top: 8cqw;
  font: 600 5cqw var(--font-display);
  letter-spacing: 0.08em;
  color: #c4b5fd;
  font-variant-numeric: tabular-nums;
}

.brand {
  position: absolute;
  bottom: 9cqw;
  padding-left: 0.4em;
  font: 700 4cqw var(--font-display);
  letter-spacing: 0.4em;
  text-transform: uppercase;
  color: #c4b5fd;
}
</style>
