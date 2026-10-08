<!-- Résumé d'un échange : qui donne quoi, statut et actions possibles. -->
<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeftRight } from 'lucide-vue-next'
import type { OwnedCard, Trade } from '@axomaster/card-model'
import { useAuthStore } from '@/stores/auth'
import { useCardsStore } from '@/stores/cards'
import CardView from '@/components/card/CardView.vue'

const props = defineProps<{ trade: Trade; busy?: boolean }>()
const emit = defineEmits<{ accept: []; decline: []; cancel: [] }>()

const auth = useAuthStore()
const store = useCardsStore()

const mine = computed(() => props.trade.from.id === auth.user?.id)
const partner = computed(() => (mine.value ? props.trade.to : props.trade.from))
/** Du point de vue du joueur connecté. */
const gives = computed<OwnedCard[]>(() => (mine.value ? props.trade.offer : props.trade.request))
const receives = computed<OwnedCard[]>(() => (mine.value ? props.trade.request : props.trade.offer))

const STATUS: Record<Trade['status'], string> = {
  pending: 'En attente',
  accepted: 'Conclu',
  declined: 'Refusé',
  cancelled: 'Annulé',
  failed: 'Impossible',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <article class="trade" :class="`status-${trade.status}`">
    <header class="head">
      <p>
        <template v-if="mine">
          Proposé à <strong>{{ partner.displayName }}</strong>
        </template>
        <template v-else>
          <strong>{{ partner.displayName }}</strong> vous propose
        </template>
        <span class="muted"> · {{ formatDate(trade.createdAt) }}</span>
      </p>
      <span class="pill">{{ STATUS[trade.status] }}</span>
    </header>

    <p v-if="trade.message" class="message">« {{ trade.message }} »</p>

    <div class="sides">
      <div class="side">
        <p class="label">Vous donnez</p>
        <div class="cards">
          <div v-for="item in gives" :key="item.card.id" class="mini">
            <CardView :card="item.card" :category="store.getCategory(item.card.categoryId)" />
            <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
          </div>
          <p v-if="!gives.length" class="muted none">Rien</p>
        </div>
      </div>
      <ArrowLeftRight class="arrow" />
      <div class="side">
        <p class="label">Vous recevez</p>
        <div class="cards">
          <div v-for="item in receives" :key="item.card.id" class="mini">
            <CardView :card="item.card" :category="store.getCategory(item.card.categoryId)" />
            <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
          </div>
          <p v-if="!receives.length" class="muted none">Rien</p>
        </div>
      </div>
    </div>

    <footer v-if="trade.status === 'pending'" class="actions">
      <template v-if="mine">
        <button class="btn btn-sm" type="button" :disabled="busy" @click="emit('cancel')">
          Annuler la proposition
        </button>
      </template>
      <template v-else>
        <button class="btn btn-sm" type="button" :disabled="busy" @click="emit('decline')">
          Refuser
        </button>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="busy"
          @click="emit('accept')"
        >
          Accepter
        </button>
      </template>
    </footer>
  </article>
</template>

<style scoped>
.trade {
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-3);
}

.pill {
  flex: none;
  padding: 2px 8px;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-2);
}

.status-pending .pill,
.status-accepted .pill {
  border-color: var(--accent);
  color: var(--accent);
}

.status-failed .pill {
  border-color: var(--danger);
  color: var(--danger);
}

.message {
  margin-top: var(--space-2);
  font: italic 500 17px var(--font-serif);
  color: var(--ink-2);
}

.sides {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-4);
  margin-top: var(--space-3);
}

.arrow {
  width: 20px;
  height: 20px;
  color: var(--ink-3);
}

.cards {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.mini {
  position: relative;
  width: 72px;
}

.qty {
  position: absolute;
  right: -4px;
  bottom: -4px;
  padding: 1px 6px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--paper);
  font-size: 11px;
  font-weight: 600;
}

.none {
  font-size: 13px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}

@media (max-width: 860px) {
  .trade {
    padding: var(--space-4);
  }

  .head {
    flex-direction: column;
    gap: var(--space-1);
  }

  .sides {
    grid-template-columns: 1fr;
  }

  .arrow {
    justify-self: center;
    transform: rotate(90deg);
  }

  .actions .btn {
    flex: 1;
  }
}
</style>
