<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { OwnedCard } from '@axomaster/card-model'
import { useCollectionStore } from '@/stores/collection'
import { useTradesStore } from '@/stores/trades'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import CardPicker from './CardPicker.vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const collection = useCollectionStore()
const trades = useTradesStore()
const toast = useToast()

const partnerId = ref('')
const partnerCards = ref<OwnedCard[]>([])
const loadingPartner = ref(false)
const offer = ref<Record<string, number>>({})
const request = ref<Record<string, number>>({})
const message = ref('')
const busy = ref(false)

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    partnerId.value = ''
    partnerCards.value = []
    offer.value = {}
    request.value = {}
    message.value = ''
    try {
      await Promise.all([
        trades.loadPlayers(),
        collection.loaded ? Promise.resolve() : collection.loadCatalogue(),
      ])
    } catch (err) {
      toast.error(errorMessage(err))
    }
  },
)

watch(partnerId, async (id) => {
  request.value = {}
  partnerCards.value = []
  if (!id) return
  loadingPartner.value = true
  try {
    partnerCards.value = await trades.playerCards(id)
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loadingPartner.value = false
  }
})

const count = (selection: Record<string, number>) =>
  Object.values(selection).reduce((sum, n) => sum + n, 0)

const offerCount = computed(() => count(offer.value))
const requestCount = computed(() => count(request.value))
const canSubmit = computed(
  () => !!partnerId.value && offerCount.value + requestCount.value > 0 && !busy.value,
)

/** Cartes dont on céderait le dernier exemplaire : elles repasseraient face cachée. */
const lastCopies = computed(() =>
  collection.inventory.filter((item) => offer.value[item.card.id] === item.quantity),
)

const toItems = (selection: Record<string, number>) =>
  Object.entries(selection).map(([cardId, quantity]) => ({ cardId, quantity }))

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  try {
    await trades.propose({
      toUserId: partnerId.value,
      offer: toItems(offer.value),
      request: toItems(request.value),
      message: message.value.trim(),
    })
    toast.show('Proposition envoyée')
    emit('close')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog :open="open" title="Proposer un échange" width="880px" @close="emit('close')">
    <div class="field">
      <label for="trade-partner">Avec</label>
      <select id="trade-partner" v-model="partnerId" class="select">
        <option value="" disabled>Choisir un joueur</option>
        <option v-for="p in trades.players" :key="p.id" :value="p.id">{{ p.displayName }}</option>
      </select>
    </div>

    <div class="sides">
      <section>
        <h3>
          Vous donnez <span v-if="offerCount" class="muted">· {{ offerCount }}</span>
        </h3>
        <CardPicker
          v-model="offer"
          :items="collection.inventory"
          empty="Vous n’avez encore aucune carte à proposer."
        />
      </section>
      <section>
        <h3>
          Vous demandez <span v-if="requestCount" class="muted">· {{ requestCount }}</span>
        </h3>
        <p v-if="!partnerId" class="muted hint">Choisissez d’abord un joueur.</p>
        <p v-else-if="loadingPartner" class="muted hint">Chargement…</p>
        <CardPicker
          v-else
          v-model="request"
          :items="partnerCards"
          empty="Ce joueur n’a encore aucune carte."
        />
      </section>
    </div>

    <p v-if="lastCopies.length" class="warning">
      Vous cédez votre dernier exemplaire de
      {{ lastCopies.map((i) => i.card.name || 'Sans titre').join(', ') }} : la carte repassera face
      cachée dans votre catalogue.
    </p>

    <div class="field">
      <label for="trade-message">Message (facultatif)</label>
      <textarea id="trade-message" v-model="message" class="textarea" rows="2" maxlength="280" />
    </div>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button class="btn btn-primary" type="button" :disabled="!canSubmit" @click="submit">
        {{ busy ? 'Envoi…' : 'Proposer' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-5);
  margin: var(--space-4) 0;
}

h3 {
  margin-bottom: var(--space-3);
  font-size: 20px;
  font-weight: 500;
}

.hint {
  font-size: 13px;
}

.warning {
  margin-bottom: var(--space-4);
  padding: var(--space-3);
  border-left: 2px solid var(--accent);
  background: var(--accent-soft);
  font-size: 13px;
}

@media (max-width: 860px) {
  .sides {
    grid-template-columns: 1fr;
  }
}
</style>
