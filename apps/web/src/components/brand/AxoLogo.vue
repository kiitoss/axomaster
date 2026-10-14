<!-- Emblème principal de l'app. Le X reste un monogramme décoratif distinct. -->
<script setup lang="ts">
import crest from '@/assets/axolotl-crest.webp'
</script>

<template>
  <span class="axo-logo" aria-hidden="true">
    <img :src="crest" alt="" draggable="false" />
  </span>
</template>

<style scoped>
.axo-logo {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  flex: none;
}

.axo-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
