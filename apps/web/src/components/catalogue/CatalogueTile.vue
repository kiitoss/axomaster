<!-- Case du catalogue : la carte si elle est possédée, sinon son dos avec son numéro. -->
<script setup lang="ts">
import { computed } from 'vue'
import {
  formatNumber,
  RARITY_INFO,
  type CatalogueEntry,
  type Category,
} from '@axomaster/card-model'
import CardView from '@/components/card/CardView.vue'
import CardBack from '@/components/booster/CardBack.vue'

const props = defineProps<{ entry: CatalogueEntry; category: Category | null }>()
const numberLabel = computed(() => {
  const number = props.entry.owned ? props.entry.card.number : props.entry.number
  return number != null ? `N° ${formatNumber(number)}` : 'Sans numéro'
})
const name = computed(() =>
  props.entry.owned ? props.entry.card.name || 'Sans titre' : 'À découvrir',
)
const rarity = computed(() => (props.entry.owned ? RARITY_INFO[props.entry.card.rarity] : null))
</script>

<template>
  <div class="tile" :class="{ hidden: !entry.owned }">
    <div class="face">
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
        variant="catalogue"
      />
    </div>
    <div class="caption">
      <span class="card-name">{{ name }}</span>
      <span class="card-detail">
        <span>{{ numberLabel }}</span>
        <span v-if="rarity" class="rarity">
          <i :style="{ background: rarity.color }" aria-hidden="true" />
          {{ rarity.label }}
        </span>
      </span>
    </div>
  </div>
</template>

<style scoped>
.tile {
  position: relative;
}

.face {
  position: relative;
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.hidden .face {
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.caption {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding-top: 12px;
}

.card-name {
  overflow: hidden;
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hidden .card-name {
  color: var(--ink-3);
  font-weight: 400;
}

.card-detail {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  color: var(--ink-3);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}

.rarity {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.rarity i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}

.quantity {
  position: absolute;
  right: 8px;
  bottom: 8px;
  display: grid;
  place-items: center;
  min-width: 30px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--shell-line);
  border-radius: 15px;
  background: var(--shell);
  color: var(--shell-ink);
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  box-shadow: var(--shadow-sm);
}
</style>
