<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Trash2 } from 'lucide-vue-next'
import type { Category } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'

const store = useCardsStore()
const toast = useToast()

const PALETTE = ['#3f5d8c', '#8b5cf6', '#5d7d68', '#6d4f8f', '#9b3b2f', '#4a463f']
const name = ref('')
const color = ref(PALETTE[0]!)

const counts = computed(() => {
  const map = new Map<string, number>()
  for (const card of store.cards) {
    if (card.categoryId) map.set(card.categoryId, (map.get(card.categoryId) ?? 0) + 1)
  }
  return map
})

async function run(action: () => Promise<unknown>) {
  try {
    await action()
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

function add() {
  if (!name.value.trim()) return
  run(async () => {
    await store.addCategory(name.value.trim(), color.value)
    name.value = ''
    color.value = PALETTE[store.categories.length % PALETTE.length]!
  })
}

/** Enregistre une collection modifiée (à la sortie du champ). */
function save(category: Category) {
  run(() => store.updateCategory(category))
}

function remove(id: string, label: string) {
  const n = counts.value.get(id) ?? 0
  const detail = n ? ` ${n} carte${n > 1 ? 's' : ''} n’auront plus de collection.` : ''
  if (confirm(`Supprimer la collection « ${label} » ?${detail}`))
    run(() => store.removeCategory(id))
}
</script>

<template>
  <div class="page">
    <ul class="list">
      <li v-for="category in store.categories" :key="category.id" class="item">
        <input
          v-model="category.color"
          type="color"
          :aria-label="`Couleur de ${category.name}`"
          @change="save(category)"
        />
        <input
          v-model="category.name"
          class="input name"
          maxlength="80"
          :aria-label="`Nom de ${category.name}`"
          @change="save(category)"
        />
        <span class="count muted">
          {{ counts.get(category.id) ?? 0 }} carte{{
            (counts.get(category.id) ?? 0) > 1 ? 's' : ''
          }}
        </span>
        <button
          class="btn btn-ghost btn-icon"
          type="button"
          title="Supprimer"
          @click="remove(category.id, category.name)"
        >
          <Trash2 />
        </button>
      </li>
      <li v-if="!store.categories.length" class="muted empty">Aucune collection pour l’instant.</li>
    </ul>

    <form class="item add" @submit.prevent="add">
      <input v-model="color" type="color" aria-label="Couleur de la nouvelle collection" />
      <input v-model="name" class="input name" placeholder="Nouvelle collection" maxlength="80" />
      <button class="btn" type="submit" :disabled="!name.trim()"><Plus /> Ajouter</button>
    </form>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}

.name {
  flex: 1;
  font: 600 16px var(--font-display);
  background: transparent;
  border-color: transparent;
}

.name:hover {
  border-color: var(--line);
}

.add .name {
  background: var(--surface);
  border-color: var(--line);
  font: 400 13px var(--font-sans);
}

.count {
  width: 80px;
  text-align: right;
  font-size: 12px;
}

.empty {
  padding: var(--space-4) 0;
}

.add {
  border-bottom: 0;
  margin-top: var(--space-3);
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4);
  }

  .count {
    width: auto;
  }
}
</style>
