<!-- Sélection de cartes (avec quantités) parmi un inventaire, pour composer un échange. -->
<script setup lang="ts">
import { Minus, Plus } from 'lucide-vue-next'
import type { OwnedCard } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import CardView from '@/components/card/CardView.vue'

defineProps<{ items: OwnedCard[]; empty: string }>()
/** Quantité choisie par identifiant de carte. */
const selection = defineModel<Record<string, number>>({ required: true })

const store = useCardsStore()

function set(item: OwnedCard, quantity: number) {
  const next = Math.max(0, Math.min(item.quantity, quantity))
  const copy = { ...selection.value }
  if (next) copy[item.card.id] = next
  else delete copy[item.card.id]
  selection.value = copy
}

function toggle(item: OwnedCard) {
  set(item, selection.value[item.card.id] ? 0 : 1)
}
</script>

<template>
  <div v-if="items.length" class="picker">
    <div
      v-for="item in items"
      :key="item.card.id"
      class="item"
      :class="{ selected: selection[item.card.id] }"
    >
      <button
        type="button"
        class="thumb"
        :aria-pressed="!!selection[item.card.id]"
        :aria-label="`${item.card.name || 'Carte'} (${item.quantity} exemplaire${item.quantity > 1 ? 's' : ''})`"
        @click="toggle(item)"
      >
        <CardView :card="item.card" :category="store.getCategory(item.card.categoryId)" />
        <span class="owned">×{{ item.quantity }}</span>
      </button>
      <div v-if="selection[item.card.id]" class="stepper">
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          aria-label="Retirer un exemplaire"
          @click="set(item, (selection[item.card.id] ?? 0) - 1)"
        >
          <Minus />
        </button>
        <span>{{ selection[item.card.id] }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          aria-label="Ajouter un exemplaire"
          :disabled="(selection[item.card.id] ?? 0) >= item.quantity"
          @click="set(item, (selection[item.card.id] ?? 0) + 1)"
        >
          <Plus />
        </button>
      </div>
      <p v-else class="name">{{ item.card.name || 'Sans titre' }}</p>
    </div>
  </div>
  <p v-else class="muted empty">{{ empty }}</p>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: var(--space-3);
  max-height: 340px;
  padding: var(--space-1);
  overflow-y: auto;
}

.item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--space-1);
  min-width: 0;
}

.thumb {
  position: relative;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition: outline-color 0.15s;
}

.selected .thumb {
  outline-color: var(--accent);
}

.owned {
  position: absolute;
  right: 4px;
  bottom: 4px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgb(29 27 24 / 0.8);
  color: #f3ecdc;
  font-size: 11px;
  font-weight: 600;
}

.name {
  overflow: hidden;
  font-size: 11px;
  text-align: center;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--ink-2);
}

.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: var(--space-4) 0;
  font-size: 13px;
}

@media (pointer: coarse) {
  .stepper .btn {
    min-width: 36px;
    min-height: 36px;
  }
}
</style>
