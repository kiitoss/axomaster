<!-- Sélection de cartes (avec quantités) parmi un inventaire, pour composer un échange. -->
<script setup lang="ts">
import { Maximize2, Minus, Plus } from 'lucide-vue-next'
import { formatNumber, type Card, type SharedCard } from '@axomaster/card-model'
import SharedCardFace from './SharedCardFace.vue'

defineProps<{ items: SharedCard[]; empty: string }>()
const emit = defineEmits<{ zoom: [card: Card] }>()
/** Quantité choisie par identifiant de carte. */
const selection = defineModel<Record<string, number>>({ required: true })

function set(item: SharedCard, quantity: number) {
  const next = Math.max(0, Math.min(item.quantity, quantity))
  const copy = { ...selection.value }
  if (next) copy[item.id] = next
  else delete copy[item.id]
  selection.value = copy
}

function toggle(item: SharedCard) {
  set(item, selection.value[item.id] ? 0 : 1)
}

const title = (item: SharedCard) =>
  item.card
    ? item.card.name || 'Sans titre'
    : item.number != null
      ? `N° ${formatNumber(item.number)}`
      : 'Carte inconnue'
</script>

<template>
  <div v-if="items.length" class="picker">
    <div
      v-for="item in items"
      :key="item.id"
      class="item"
      :class="{ selected: selection[item.id] }"
    >
      <div class="frame">
        <button
          type="button"
          class="thumb"
          :aria-pressed="!!selection[item.id]"
          :aria-label="`${title(item)} (${item.quantity} exemplaire${item.quantity > 1 ? 's' : ''})`"
          @click="toggle(item)"
        >
          <SharedCardFace :item="item" />
          <span class="owned">×{{ item.quantity }}</span>
        </button>
        <button
          v-if="item.card"
          type="button"
          class="zoom"
          aria-label="Agrandir la carte"
          title="Agrandir"
          @click="emit('zoom', item.card)"
        >
          <Maximize2 />
        </button>
      </div>
      <div v-if="selection[item.id]" class="stepper">
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          aria-label="Retirer un exemplaire"
          @click="set(item, (selection[item.id] ?? 0) - 1)"
        >
          <Minus />
        </button>
        <span>{{ selection[item.id] }}</span>
        <button
          type="button"
          class="btn btn-ghost btn-icon btn-sm"
          aria-label="Ajouter un exemplaire"
          :disabled="(selection[item.id] ?? 0) >= item.quantity"
          @click="set(item, (selection[item.id] ?? 0) + 1)"
        >
          <Plus />
        </button>
      </div>
      <p v-else class="name">{{ title(item) }}</p>
    </div>
  </div>
  <p v-else class="muted empty">{{ empty }}</p>
</template>

<style scoped>
.picker {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: var(--space-3);
  max-height: 440px;
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

.frame {
  position: relative;
}

.thumb {
  position: relative;
  display: block;
  width: 100%;
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
  background: rgb(15 23 42 / 0.8);
  color: #f1f5f9;
  font-size: 11px;
  font-weight: 600;
}

.zoom {
  position: absolute;
  top: 4px;
  right: 4px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: rgb(15 23 42 / 0.7);
  color: #f1f5f9;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
}

.zoom svg {
  width: 14px;
  height: 14px;
}

.frame:hover .zoom,
.zoom:focus-visible {
  opacity: 1;
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

@media (max-width: 860px) {
  .picker {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
    max-height: none;
  }
}

@media (pointer: coarse) {
  .zoom {
    width: 36px;
    height: 36px;
    opacity: 1;
  }

  .stepper .btn {
    min-width: 36px;
    min-height: 36px;
  }
}
</style>
