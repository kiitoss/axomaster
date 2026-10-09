<!-- Avatar d'un joueur : photo (future connexion Microsoft) ou initiales sur une teinte stable. -->
<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ id: string; name: string; size?: number; src?: string | null }>(),
  { size: 32, src: null },
)

const initials = computed(() => {
  const words = props.name.trim().split(/\s+/).filter(Boolean)
  const letters =
    words.length > 1 ? words[0]![0]! + words[words.length - 1]![0]! : (words[0] ?? '?').slice(0, 2)
  return letters.toUpperCase()
})

/** Teinte dérivée de l'identifiant : un joueur garde toujours la même couleur. */
const hue = computed(() => {
  let hash = 0
  for (const ch of props.id) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return Math.abs(hash) % 360
})
</script>

<template>
  <span
    class="avatar"
    :style="{ '--size': `${size}px`, '--hue': hue }"
    :title="name"
    aria-hidden="true"
  >
    <img v-if="src" :src="src" alt="" />
    <template v-else>{{ initials }}</template>
  </span>
</template>

<style scoped>
.avatar {
  flex: none;
  display: inline-grid;
  place-items: center;
  width: var(--size);
  height: var(--size);
  overflow: hidden;
  border-radius: 50%;
  background: hsl(var(--hue) 70% 92%);
  color: hsl(var(--hue) 45% 32%);
  font: 600 calc(var(--size) * 0.38) / 1 var(--font-sans);
  letter-spacing: 0.02em;
  user-select: none;
}

:root[data-theme='dark'] .avatar {
  background: hsl(var(--hue) 35% 24%);
  color: hsl(var(--hue) 80% 85%);
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
