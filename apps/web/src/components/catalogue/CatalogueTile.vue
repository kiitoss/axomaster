<!-- Case du catalogue : la carte si elle est possédée, sinon son dos avec son numéro. -->
<script setup lang="ts">
import { formatNumber, type CatalogueEntry, type Category } from '@axomaster/card-model'
import CardView from '@/components/card/CardView.vue'
import CardBack from '@/components/booster/CardBack.vue'

defineProps<{ entry: CatalogueEntry; category: Category | null }>()
</script>

<template>
  <div class="tile" :class="{ hidden: !entry.owned }">
    <template v-if="entry.owned">
      <CardView :card="entry.card" :category="category" interactive />
      <span v-if="entry.quantity > 1" class="quantity" :title="`${entry.quantity} exemplaires`">
        ×{{ entry.quantity }}
      </span>
    </template>
    <CardBack
      v-else
      :label="entry.number != null ? `N° ${formatNumber(entry.number)}` : undefined"
      :color="category?.color"
    />
  </div>
</template>

<style scoped>
.tile {
  position: relative;
}

.hidden {
  border-radius: 12px;
  opacity: 0.82;
  filter: saturate(0.7);
  transition:
    opacity 0.2s,
    filter 0.2s;
}

@media (hover: hover) {
  .hidden:hover {
    opacity: 1;
    filter: none;
  }
}

.quantity {
  position: absolute;
  right: -6px;
  bottom: -6px;
  display: grid;
  place-items: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 2px solid var(--surface);
  border-radius: 15px;
  background: var(--ink);
  color: var(--paper);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow-sm);
}
</style>
