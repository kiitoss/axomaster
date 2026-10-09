<!-- Tableau joueurs × cartes (admin et classement) : cartes en en-tête, total en tête de ligne. -->
<script setup lang="ts">
import { formatNumber } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import CardView from '@/components/card/CardView.vue'
import CardBack from '@/components/booster/CardBack.vue'
import PlayerAvatar from './PlayerAvatar.vue'
import type { MatrixColumn, MatrixRow } from './matrix'

defineProps<{
  columns: MatrixColumn[]
  rows: MatrixRow[]
  /** Totaux par carte, en pied de tableau. */
  footer?: number[]
  /** Le nom du joueur est cliquable (événement `player`). */
  playerLink?: boolean
}>()
const emit = defineEmits<{ card: [id: string]; player: [id: string] }>()

const store = useCardsStore()

const ordinal = (rank: number) => (rank === 1 ? '1er' : `${rank}e`)
</script>

<template>
  <div class="scroller">
    <table>
      <thead>
        <tr>
          <th class="player" scope="col" />
          <th class="total" scope="col">
            Total <span class="of">/ {{ columns.length }}</span>
          </th>
          <th
            v-for="col in columns"
            :key="col.id"
            class="card-head"
            :class="{ gap: col.groupStart }"
            scope="col"
            :title="col.label"
          >
            <button
              v-if="col.card"
              type="button"
              class="thumb"
              :class="{ dim: col.dim }"
              :aria-label="`Agrandir ${col.label}`"
              @click="emit('card', col.id)"
            >
              <CardView :card="col.card" :category="store.getCategory(col.card.categoryId)" />
            </button>
            <div v-else class="thumb hidden" :aria-label="col.label">
              <CardBack
                :label="col.number != null ? `N° ${formatNumber(col.number)}` : undefined"
                :color="col.color"
              />
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" :class="{ me: row.me, disabled: row.disabled }">
          <th class="player" scope="row">
            <component
              :is="playerLink ? 'button' : 'div'"
              :type="playerLink ? 'button' : undefined"
              class="who"
              :title="playerLink ? 'Voir sa collection' : undefined"
              @click="playerLink && emit('player', row.id)"
            >
              <span class="avatar">
                <PlayerAvatar :id="row.id" :name="row.name" :size="28" />
                <span
                  v-if="row.rank"
                  class="rank"
                  :class="{ podium: row.rank <= 3 && row.total > 0 }"
                  :title="ordinal(row.rank)"
                >
                  {{ row.rank }}
                </span>
              </span>
              <span class="name">{{ row.name }}</span>
            </component>
          </th>
          <td class="total">
            <strong>{{ row.total }}</strong>
          </td>
          <td
            v-for="col in columns"
            :key="col.id"
            :class="{ gap: col.groupStart }"
            :title="`${row.name} · ${col.label}`"
          >
            <span
              v-if="row.quantities.get(col.id)"
              class="dot on"
              :aria-label="`${row.quantities.get(col.id)} exemplaire(s)`"
            >
              <template v-if="row.quantities.get(col.id)! > 1">
                {{ row.quantities.get(col.id) }}
              </template>
            </span>
            <span v-else class="dot" aria-label="Non possédée" />
          </td>
        </tr>
      </tbody>
      <tfoot v-if="footer">
        <tr>
          <th class="player" scope="row">Joueurs</th>
          <td class="total" />
          <td
            v-for="(count, i) in footer"
            :key="columns[i]!.id"
            class="count"
            :class="{ gap: columns[i]!.groupStart }"
          >
            {{ count }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>

<style scoped>
.scroller {
  --player-w: 180px;
  --total-w: 64px;
  width: fit-content;
  max-width: 100%;
  max-height: calc(100dvh - var(--header-h) - var(--tabbar-h) - 120px);
  min-height: 240px;
  overflow: auto;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
}

th,
td {
  padding: 4px;
  border-bottom: 1px solid var(--line);
  background: var(--surface);
  text-align: center;
  white-space: nowrap;
}

.gap {
  border-left: 1px solid var(--line-strong);
}

thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  padding: 6px 4px;
  vertical-align: bottom;
}

tfoot th,
tfoot td {
  position: sticky;
  bottom: 0;
  z-index: 2;
  border-top: 1px solid var(--line-strong);
  border-bottom: 0;
  background: var(--paper-2);
  font-weight: 600;
  color: var(--ink-2);
}

/* Colonnes figées : joueur puis total. */
.player {
  position: sticky;
  left: 0;
  z-index: 1;
  width: var(--player-w);
  min-width: var(--player-w);
  max-width: var(--player-w);
  padding: 4px var(--space-3);
  text-align: left;
  font-weight: 500;
}

.total {
  position: sticky;
  left: var(--player-w);
  z-index: 1;
  width: var(--total-w);
  min-width: var(--total-w);
  border-right: 1px solid var(--line-strong);
  font-variant-numeric: tabular-nums;
}

thead .player,
thead .total,
tfoot .player,
tfoot .total {
  z-index: 3;
}

thead .total {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-3);
}

.of {
  display: block;
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
}

tbody .total strong {
  font-size: 15px;
}

.who {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  width: 100%;
  min-height: 36px;
  padding: 0;
  border: 0;
  background: none;
  color: var(--ink);
  font: inherit;
  text-align: left;
}

button.who {
  cursor: pointer;
}

@media (hover: hover) {
  button.who:hover .name {
    text-decoration: underline;
  }
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
}

tr.me .name {
  font-weight: 700;
}

tr.disabled .who {
  opacity: 0.5;
}

.avatar {
  position: relative;
  flex: none;
  display: inline-flex;
}

.rank {
  position: absolute;
  right: -5px;
  bottom: -4px;
  display: grid;
  place-items: center;
  min-width: 16px;
  height: 16px;
  padding: 0 3px;
  border: 1.5px solid var(--surface);
  border-radius: 8px;
  background: var(--paper-3);
  color: var(--ink-2);
  font: 700 9px / 1 var(--font-sans);
  font-variant-numeric: tabular-nums;
}

.rank.podium {
  background: var(--brand-gradient);
  color: var(--night);
}

tbody tr.me th,
tbody tr.me td {
  background: var(--accent-tint);
}

@media (hover: hover) {
  tbody tr:hover th,
  tbody tr:hover td {
    background: var(--accent-tint);
  }
}

.thumb {
  display: block;
  width: 72px;
  margin: 0 auto;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
}

button.thumb {
  cursor: zoom-in;
  transition: transform 0.15s;
}

@media (hover: hover) {
  button.thumb:hover {
    transform: translateY(-2px);
  }
}

.thumb.dim,
.thumb.hidden {
  opacity: 0.6;
}

.dot {
  display: inline-grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1.5px solid var(--line-strong);
  border-radius: 50%;
  font-size: 10px;
  font-weight: 700;
  color: var(--paper);
}

.dot.on {
  border-color: var(--accent);
  background: var(--accent);
}

.count {
  font-variant-numeric: tabular-nums;
}

@media (max-width: 860px) {
  .scroller {
    --player-w: 120px;
    --total-w: 52px;
  }

  .thumb {
    width: 60px;
  }
}
</style>
