<script setup lang="ts">
import { onMounted, ref } from 'vue'
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
const showHistory = ref(false)

onMounted(async () => {
  try {
    await Promise.all([trades.load(), store.ensureCategories()])
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
    <section class="intro">
      <div>
        <p class="eyebrow">Entre joueurs</p>
        <h1>Échanges</h1>
        <p class="muted">
          Proposez vos doublons contre les cartes qui vous manquent. L’échange n’a lieu que si
          l’autre joueur accepte.
        </p>
      </div>
      <button class="btn btn-primary" type="button" @click="composing = true">
        <ArrowLeftRight /> Proposer un échange
      </button>
    </section>

    <p v-if="loading" class="muted">Chargement…</p>

    <template v-else>
      <section class="block">
        <h2>
          Reçues <span class="muted">{{ trades.incoming.length }}</span>
        </h2>
        <TradeCard
          v-for="trade in trades.incoming"
          :key="trade.id"
          :trade="trade"
          :busy="busyId === trade.id"
          @accept="act(trade, 'accept')"
          @decline="act(trade, 'decline')"
        />
        <p v-if="!trades.incoming.length" class="muted none">Aucune proposition en attente.</p>
      </section>

      <section class="block">
        <h2>
          Envoyées <span class="muted">{{ trades.outgoing.length }}</span>
        </h2>
        <TradeCard
          v-for="trade in trades.outgoing"
          :key="trade.id"
          :trade="trade"
          :busy="busyId === trade.id"
          @cancel="act(trade, 'cancel')"
        />
        <p v-if="!trades.outgoing.length" class="muted none">Aucune proposition envoyée.</p>
      </section>

      <section v-if="trades.history.length" class="block">
        <button class="btn btn-ghost btn-sm" type="button" @click="showHistory = !showHistory">
          {{ showHistory ? 'Masquer' : 'Afficher' }} l’historique ({{ trades.history.length }})
        </button>
        <template v-if="showHistory">
          <TradeCard v-for="trade in trades.history" :key="trade.id" :trade="trade" />
        </template>
      </section>
    </template>

    <TradeComposer :open="composing" @close="composing = false" />
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-6);
}

.intro {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-5);
  margin-bottom: var(--space-6);
}

.intro h1 {
  font-size: 52px;
  line-height: 1.05;
  font-weight: 500;
}

.intro .muted {
  max-width: 520px;
  margin-top: var(--space-2);
}

.block {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5) 0;
  border-top: 1px solid var(--line);
}

.block h2 {
  font-size: 26px;
  font-weight: 500;
}

.block h2 .muted {
  font: 500 14px var(--font-sans);
}

.block > .btn {
  align-self: flex-start;
}

.none {
  font-size: 13px;
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .intro {
    flex-direction: column;
    align-items: stretch;
  }

  .intro h1 {
    font-size: 40px;
  }
}
</style>
