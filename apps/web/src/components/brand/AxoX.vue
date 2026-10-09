<!-- Le « X » du logo. Sans dégradé, il prend la couleur du texte (currentColor). -->
<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  /** Dégradé de remplissage : violet (charte) ou clair (sur fond coloré). */
  gradient?: 'violet' | 'light'
}>()

const id = useId()

const stops = computed(() =>
  props.gradient === 'light' ? ['#ffffff', '#ede9fe'] : ['#c4b5fd', '#7c3aed'],
)
</script>

<template>
  <svg class="axo-x" viewBox="0 0 20.5 24" aria-hidden="true">
    <defs v-if="gradient">
      <linearGradient :id="id" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="stops[0]" />
        <stop offset="1" :stop-color="stops[1]" />
      </linearGradient>
    </defs>
    <path
      :fill="gradient ? `url(#${id})` : 'currentColor'"
      fill-rule="evenodd"
      d="M0.04 0.24C0.04 2.751 1.43 5.125 3.028 7.174C4.289 8.792 5.859 10.426 7.442 12.009C5.86 13.59 4.293 15.222 3.033 16.838C1.435 18.887 0.045 21.261 0.045 23.772H3.986C3.986 22.646 4.653 21.169 6.141 19.261C7.262 17.822 8.688 16.336 10.241 14.784C11.793 16.336 13.219 17.822 14.34 19.261C15.828 21.169 16.495 22.646 16.495 23.772H20.436C20.436 21.261 19.046 18.887 17.448 16.838C16.188 15.222 14.621 13.59 13.039 12.009C14.622 10.426 16.192 8.792 17.453 7.174C19.051 5.125 20.441 2.751 20.441 0.24H16.5C16.5 1.366 15.833 2.843 14.346 4.751C13.223 6.191 11.795 7.679 10.241 9.233C8.686 7.679 7.258 6.191 6.135 4.751C4.648 2.843 3.981 1.366 3.981 0.24H0.04Z"
    />
  </svg>
</template>

<style scoped>
.axo-x {
  display: block;
  width: 100%;
  height: auto;
  overflow: visible;
}
</style>
