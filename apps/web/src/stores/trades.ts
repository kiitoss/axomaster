import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { CreateTradeRequest, Player, SharedCard, Trade } from '@axomaster/card-model'
import { get, post } from '@/api/client'
import { useAuthStore } from './auth'
import { useCollectionStore } from './collection'

export const useTradesStore = defineStore('trades', () => {
  const auth = useAuthStore()
  const collection = useCollectionStore()

  const trades = ref<Trade[]>([])
  const players = ref<Player[]>([])

  const me = computed(() => auth.user?.id)
  const incoming = computed(() =>
    trades.value.filter((t) => t.status === 'pending' && t.to.id === me.value),
  )
  const outgoing = computed(() =>
    trades.value.filter((t) => t.status === 'pending' && t.from.id === me.value),
  )
  const history = computed(() => trades.value.filter((t) => t.status !== 'pending'))

  async function load() {
    trades.value = await get<Trade[]>('trades')
  }

  async function loadPlayers() {
    players.value = await get<Player[]>('players')
  }

  function playerCards(id: string) {
    return get<SharedCard[]>(`players/${encodeURIComponent(id)}/cards`)
  }

  async function propose(request: CreateTradeRequest) {
    const trade = await post<Trade>('trades', request)
    trades.value.unshift(trade)
    return trade
  }

  async function act(trade: Trade, action: 'accept' | 'decline' | 'cancel') {
    try {
      await post(`trades/${encodeURIComponent(trade.id)}/${action}`)
    } finally {
      // Le statut a pu changer côté serveur (échec, déjà traité) : on recharge dans tous les cas.
      await load()
      if (action === 'accept') collection.loaded = false
    }
  }

  return {
    trades,
    players,
    incoming,
    outgoing,
    history,
    load,
    loadPlayers,
    playerCards,
    propose,
    accept: (t: Trade) => act(t, 'accept'),
    decline: (t: Trade) => act(t, 'decline'),
    cancel: (t: Trade) => act(t, 'cancel'),
  }
})
