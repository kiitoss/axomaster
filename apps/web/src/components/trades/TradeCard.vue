<!-- Résumé d'un échange sur une seule bande : qui, ce qui part et ce qui arrive, statut ou actions. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight } from 'lucide-vue-next'
import { formatNumber, type Card, type SharedCard, type Trade } from '@axomaster/card-model'
import { useAuthStore } from '@/stores/auth'
import CardViewer from '@/components/gallery/CardViewer.vue'
import PlayerAvatar from '@/components/players/PlayerAvatar.vue'
import SharedCardFace from './SharedCardFace.vue'

const props = defineProps<{ trade: Trade; busy?: boolean; compact?: boolean }>()
const emit = defineEmits<{ accept: []; decline: []; cancel: [] }>()

const auth = useAuthStore()

const mine = computed(() => props.trade.from.id === auth.user?.id)
const partner = computed(() => (mine.value ? props.trade.to : props.trade.from))
/** Du point de vue du joueur connecté. */
const gives = computed<SharedCard[]>(() => (mine.value ? props.trade.offer : props.trade.request))
const receives = computed<SharedCard[]>(() =>
  mine.value ? props.trade.request : props.trade.offer,
)
const pending = computed(() => props.trade.status === 'pending')

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

const title = (item: SharedCard) =>
  item.card
    ? item.card.name || 'Sans titre'
    : `${item.number != null ? `N° ${formatNumber(item.number)}` : 'Carte'} · pas encore débloquée`

/** Cartes visibles de l'échange (les deux côtés), pour la visionneuse. */
const visible = computed<Card[]>(() =>
  [...gives.value, ...receives.value].flatMap((item) => (item.card ? [item.card] : [])),
)
const viewer = ref<{ index: number } | null>(null)

function open(card: Card) {
  viewer.value = {
    index: Math.max(
      0,
      visible.value.findIndex((c) => c.id === card.id),
    ),
  }
}

const sides = computed(() => [
  { key: 'gives', label: 'Vous donnez', items: gives.value },
  { key: 'receives', label: 'Vous recevez', items: receives.value },
])
</script>

<template>
  <article class="trade" :class="[`status-${trade.status}`, { compact }]">
    <div class="who">
      <PlayerAvatar :id="partner.id" :name="partner.displayName" :size="compact ? 28 : 36" />
      <div class="who-text">
        <p class="name">{{ partner.displayName }}</p>
        <p class="meta">
          {{ mine ? 'Proposé' : 'Vous propose' }} ·
          {{ formatDate(trade.resolvedAt ?? trade.createdAt) }}
        </p>
        <p v-if="trade.message && !compact" class="message" :title="trade.message">
          « {{ trade.message }} »
        </p>
      </div>
      <span v-if="!pending || mine" class="pill">{{ STATUS[trade.status] }}</span>
    </div>

    <div class="exchange">
      <template v-for="(side, i) in sides" :key="side.key">
        <ArrowRight v-if="i === 1" class="arrow" aria-hidden="true" />
        <div class="side">
          <p class="label">{{ side.label }}</p>
          <div class="cards">
            <component
              :is="item.card ? 'button' : 'div'"
              v-for="item in side.items"
              :key="item.id"
              class="mini"
              :type="item.card ? 'button' : undefined"
              :title="title(item)"
              :aria-label="item.card ? `Agrandir ${title(item)}` : title(item)"
              @click="item.card && open(item.card)"
            >
              <SharedCardFace :item="item" />
              <span v-if="item.quantity > 1" class="qty">×{{ item.quantity }}</span>
            </component>
            <p v-if="!side.items.length" class="none">Rien</p>
          </div>
        </div>
      </template>
    </div>

    <footer v-if="pending" class="actions">
      <button v-if="mine" class="btn btn-sm" type="button" :disabled="busy" @click="emit('cancel')">
        Annuler
      </button>
      <template v-else>
        <button
          class="btn btn-primary btn-sm"
          type="button"
          :disabled="busy"
          @click="emit('accept')"
        >
          Accepter
        </button>
        <button class="btn btn-sm" type="button" :disabled="busy" @click="emit('decline')">
          Refuser
        </button>
      </template>
    </footer>

    <CardViewer
      v-if="viewer"
      v-model:index="viewer.index"
      :cards="visible"
      readonly
      @close="viewer = null"
    />
  </article>
</template>

<style scoped>
.trade {
  --mini: 84px;
  display: grid;
  grid-template-columns: minmax(150px, 220px) 1fr auto;
  align-items: center;
  gap: var(--space-5);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.trade:not(.status-pending) {
  grid-template-columns: minmax(150px, 220px) 1fr;
}

.trade.status-pending:not(.compact) {
  border-left: 3px solid var(--accent);
}

.trade.compact {
  --mini: 52px;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  background: transparent;
}

.who {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.who-text {
  min-width: 0;
}

.name {
  overflow: hidden;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.meta {
  font-size: 12px;
  color: var(--ink-3);
}

.message {
  overflow: hidden;
  margin-top: 2px;
  font-size: 12px;
  font-style: italic;
  color: var(--ink-2);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.exchange {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}

.side {
  min-width: 0;
}

.label {
  margin-bottom: 4px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.compact .label {
  display: none;
}

.arrow {
  flex: none;
  width: 18px;
  height: 18px;
  margin-top: 14px;
  color: var(--ink-3);
}

.compact .arrow {
  margin-top: 0;
}

.cards {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-height: calc(var(--mini) * 880 / 630);
}

.mini {
  position: relative;
  flex: none;
  width: var(--mini);
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  font: inherit;
}

button.mini {
  cursor: zoom-in;
  transition: transform 0.15s;
}

@media (hover: hover) {
  button.mini:hover {
    transform: translateY(-2px);
  }
}

.qty {
  position: absolute;
  right: -4px;
  bottom: -4px;
  padding: 1px 5px;
  border-radius: 8px;
  background: var(--ink);
  color: var(--paper);
  font-size: 10px;
  font-weight: 600;
}

.none {
  font-size: 13px;
  color: var(--ink-3);
}

.actions {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.pill {
  flex: none;
  margin-left: auto;
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

@media (max-width: 860px) {
  .trade,
  .trade:not(.status-pending) {
    grid-template-columns: 1fr;
    gap: var(--space-3);
    padding: var(--space-3);
  }

  .trade.compact {
    gap: var(--space-2);
  }

  .exchange {
    overflow-x: auto;
  }

  .side {
    flex: none;
  }

  .cards {
    flex-wrap: nowrap;
  }

  .actions {
    flex-direction: row;
  }

  .actions .btn {
    flex: 1;
  }
}
</style>
