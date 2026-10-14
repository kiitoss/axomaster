<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { Pencil, Plus, Trash2 } from 'lucide-vue-next'
import type { Card, CreationStatus, MyCreation } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useCreationsStore } from '@/stores/creations'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import { formatDateTime, formatDuration } from '@/lib/format'
import CardView from '@/components/card/CardView.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'

// Quota et cartes sont chargés par la garde du routeur (meta.creations).
const store = useCardsStore()
const creations = useCreationsStore()
const router = useRouter()
const toast = useToast()

const quota = computed(() => creations.quota)
const closed = computed(() => !!quota.value && !quota.value.unlimited && quota.value.limit <= 0)
const canCreate = computed(() => !!quota.value && quota.value.remaining > 0)

const SECTIONS: { status: CreationStatus; title: string; hint?: string }[] = [
  {
    status: 'rejected',
    title: 'Refusées',
    hint: 'Corrigez-les puis renvoyez-les : elles repasseront en validation.',
  },
  {
    status: 'pending',
    title: 'En attente de validation',
  },
  {
    status: 'published',
    title: 'Validées',
  },
]

const sections = computed(() =>
  SECTIONS.map((section) => ({
    ...section,
    items: creations.creations.filter((c) => c.status === section.status),
  })).filter((section) => section.items.length),
)

const published = computed<Card[]>(() =>
  creations.creations.filter((c) => c.status === 'published').map((c) => c.card),
)
const viewerIndex = ref<number | null>(null)

function open(creation: MyCreation) {
  if (creation.status === 'published')
    viewerIndex.value = published.value.findIndex((c) => c.id === creation.card.id)
  else router.push(`/creations/editor/${creation.card.id}`)
}

async function remove(creation: MyCreation) {
  const name = creation.card.name || 'cette carte'
  const warning = quota.value?.unlimited ? '' : ' La création déjà comptée ne vous sera pas rendue.'
  if (!confirm(`Retirer « ${name} » ?${warning}`)) return
  try {
    await creations.remove(creation.card.id)
    toast.show('Carte retirée')
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
</script>

<template>
  <div class="page">
    <header class="head">
      <div v-if="quota" class="quota" :class="{ exhausted: !canCreate }">
        <template v-if="quota.unlimited">
          <p class="quota-count">Création illimitée <span class="muted">(admin)</span></p>
        </template>
        <template v-else-if="closed">
          <p class="quota-count">Création fermée</p>
          <p class="muted">Les propositions sont suspendues pour le moment.</p>
        </template>
        <template v-else>
          <p class="eyebrow">Créations disponibles</p>
          <p class="quota-count">
            <strong>{{ quota.remaining }}</strong> / {{ quota.limit }}
          </p>
          <div class="dots" aria-hidden="true">
            <span v-for="i in quota.limit" :key="i" :class="{ used: i > quota.remaining }" />
          </div>
          <p class="muted">
            {{ quota.limit }} carte{{ quota.limit > 1 ? 's' : '' }} sur
            {{ formatDuration(quota.windowSeconds) }} glissants.
            <template v-if="quota.nextAt">
              Prochaine le {{ formatDateTime(quota.nextAt) }}.
            </template>
          </p>
        </template>

        <RouterLink v-if="canCreate" to="/creations/editor" class="btn btn-primary">
          <Plus /> Nouvelle carte
        </RouterLink>
        <button v-else class="btn btn-primary" type="button" disabled>
          <Plus /> Nouvelle carte
        </button>
      </div>
    </header>

    <section v-for="section in sections" :key="section.status" class="section">
      <h2>
        {{ section.title }} <span class="muted">{{ section.items.length }}</span>
      </h2>
      <p v-if="section.hint" class="muted hint">{{ section.hint }}</p>

      <div class="grid">
        <article
          v-for="creation in section.items"
          :key="creation.card.id"
          class="item"
          :class="creation.status"
        >
          <button
            type="button"
            class="cell"
            :aria-label="`${creation.status === 'published' ? 'Voir' : 'Modifier'} ${creation.card.name || 'la carte'}`"
            @click="open(creation)"
          >
            <CardView
              :card="creation.card"
              :category="store.getCategory(creation.card.categoryId)"
              interactive
            />
          </button>
          <p v-if="creation.status === 'rejected'" class="note">
            {{ creation.reviewNote || 'Aucun motif précisé.' }}
          </p>
          <div v-if="creation.status !== 'published'" class="item-actions">
            <RouterLink :to="`/creations/editor/${creation.card.id}`" class="btn btn-sm">
              <Pencil /> Modifier
            </RouterLink>
            <button
              class="btn btn-sm btn-ghost btn-icon"
              type="button"
              aria-label="Retirer la carte"
              title="Retirer la carte"
              @click="remove(creation)"
            >
              <Trash2 />
            </button>
          </div>
        </article>
      </div>
    </section>

    <section v-if="!creations.creations.length" class="empty">
      <h2>Aucune carte proposée</h2>
    </section>

    <CardViewer
      v-if="viewerIndex !== null && published.length"
      v-model:index="viewerIndex"
      :cards="published"
      readonly
      @close="viewerIndex = null"
    />
  </div>
</template>

<style scoped>
.page {
  max-width: 1320px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-6) var(--space-7);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.quota {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--space-2);
  width: 100%;
  min-width: 0;
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--accent-tint);
  border-left: 3px solid var(--accent);
}

.quota > :not(.btn) {
  grid-column: 1;
}

.quota .muted {
  font-size: 13px;
}

.quota-count {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

.quota-count strong {
  font: 700 24px / 1 var(--font-display);
  color: var(--accent);
}

.quota.exhausted .quota-count strong {
  color: var(--ink-3);
}

.dots {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dots span {
  width: 22px;
  height: 6px;
  border-radius: 3px;
  background: var(--accent);
}

.dots span.used {
  background: var(--paper-3);
}

.quota .btn {
  grid-column: 2;
  grid-row: 1 / span 5;
  align-self: center;
  text-decoration: none;
}

.section {
  margin-bottom: var(--space-6);
}

.section h2 {
  margin-bottom: var(--space-4);
  font-size: 16px;
  font-weight: 600;
}

.section h2:has(+ .hint) {
  margin-bottom: 0;
}

.section h2 .muted {
  font-size: 16px;
}

.hint {
  margin: var(--space-1) 0 var(--space-4);
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-5) var(--space-4);
  padding: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--album);
}

.item {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.cell {
  padding: 0;
  border: 0;
  background: none;
  border-radius: 12px;
  cursor: pointer;
  box-shadow: var(--shadow);
}

.item.pending .cell {
  opacity: 0.9;
}

.note {
  padding: var(--space-2) var(--space-3);
  border-left: 3px solid var(--danger);
  border-radius: 4px;
  background: var(--paper-2);
  font-size: 13px;
  color: var(--ink-2);
}

.item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.item-actions .btn {
  text-decoration: none;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-4);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius-lg);
  background: var(--paper-2);
  text-align: center;
}

.empty h2 {
  font-size: 16px;
  font-weight: 500;
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .quota {
    flex: 1 1 100%;
    min-width: 0;
    grid-template-columns: minmax(0, 1fr);
    padding: var(--space-4);
  }

  .quota .btn {
    grid-column: 1;
    grid-row: auto;
    justify-self: stretch;
    justify-content: center;
  }

  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-4) var(--space-3);
    padding: var(--space-3);
  }
}

@media (min-width: 600px) and (max-width: 860px) {
  .grid {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
