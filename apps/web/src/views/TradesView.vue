<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import type { Trade } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useTradesStore } from '@/stores/trades'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import TradeCard from '@/components/trades/TradeCard.vue'
import TradeComposer from '@/components/trades/TradeComposer.vue'

const store = useCardsStore()
const trades = useTradesStore()
const toast = useToast()

const loading = ref(true)
const composing = ref(false)
const busyId = ref<string | null>(null)

type Tab = 'incoming' | 'outgoing' | 'history'
const tab = ref<Tab>('incoming')

const TABS: { key: Tab; label: string; empty: string }[] = [
  { key: 'incoming', label: 'Reçues', empty: 'Aucune proposition en attente.' },
  { key: 'outgoing', label: 'Envoyées', empty: 'Aucune proposition envoyée.' },
  { key: 'history', label: 'Historique', empty: 'Aucun échange terminé.' },
]
const current = computed(() => TABS.find((t) => t.key === tab.value)!)

onMounted(async () => {
  try {
    await Promise.all([trades.load(), store.ensureCategories()])
    // Ouvre directement l'onglet utile.
    if (!trades.incoming.length && trades.outgoing.length) tab.value = 'outgoing'
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loading.value = false
  }
})

const MESSAGES = {
  accept: 'Échange conclu : les cartes ont rejoint votre catalogue',
  decline: 'Proposition refusée',
  cancel: 'Proposition annulée',
} as const

async function act(trade: Trade, action: keyof typeof MESSAGES) {
  if (action === 'accept' && !confirm('Accepter cet échange ?')) return
  busyId.value = trade.id
  try {
    await trades[action](trade)
    toast.show(MESSAGES[action])
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="page">
    <header class="toolbar">
      <h1>Échanges</h1>
      <button
        class="btn btn-primary"
        type="button"
        title="Proposez vos doublons contre les cartes qui vous manquent"
        @click="composing = true"
      >
        <ArrowLeftRight /> Proposer un échange
      </button>
    </header>

    <nav class="tabs" aria-label="Échanges">
      <button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        :class="{ active: tab === t.key }"
        :aria-current="tab === t.key ? 'page' : undefined"
        @click="tab = t.key"
      >
        {{ t.label }}
        <span v-if="trades[t.key].length" class="count" :class="{ alert: t.key === 'incoming' }">
          {{ trades[t.key].length }}
        </span>
      </button>
    </nav>

    <p v-if="loading" class="muted">Chargement…</p>

    <section v-else class="list">
      <TradeCard
        v-for="trade in trades[tab]"
        :key="trade.id"
        :trade="trade"
        :busy="busyId === trade.id"
        :compact="tab === 'history'"
        @accept="act(trade, 'accept')"
        @decline="act(trade, 'decline')"
        @cancel="act(trade, 'cancel')"
      />
      <p v-if="!trades[tab].length" class="muted none">{{ current.empty }}</p>
    </section>

    <TradeComposer :open="composing" @close="composing = false" />
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-6) var(--space-6) var(--space-7);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.toolbar h1 {
  font-size: 32px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.tabs {
  display: flex;
  gap: var(--space-5);
  margin-bottom: var(--space-4);
  border-bottom: 1px solid var(--line);
}

.tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 0;
  border: 0;
  background: none;
  font: 500 14px var(--font-sans);
  color: var(--ink-3);
  cursor: pointer;
}

.tabs button:hover {
  color: var(--ink);
}

.tabs button.active {
  color: var(--ink);
  font-weight: 600;
}

.tabs button.active::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--accent);
}

.count {
  min-width: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--paper-3);
  color: var(--ink-2);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.count.alert {
  background: var(--accent);
  color: var(--paper);
}

.list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.none {
  padding: var(--space-5) 0;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .toolbar h1 {
    display: none;
  }

  .toolbar .btn {
    flex: 1;
  }

  .tabs {
    justify-content: space-around;
  }
}
</style>
