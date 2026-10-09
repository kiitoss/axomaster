<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { Save } from 'lucide-vue-next'
import type { BoosterSettings, GiftBoostersRequest } from '@axomaster/card-model'
import { get, post, put, errorMessage } from '@/api/client'
import { useToast } from '@/composables/useToast'
import GiftForm from '@/components/players/GiftForm.vue'

const toast = useToast()

const settings = ref<BoosterSettings | null>(null)
const saved = ref('')
const saving = ref(false)
const gifting = ref(false)
const giftForm = useTemplateRef('giftForm')

/** Périodes proposées, en secondes. */
const PRESETS = [
  { value: 3600, label: 'Toutes les heures' },
  { value: 3 * 3600, label: 'Toutes les 3 heures' },
  { value: 6 * 3600, label: 'Toutes les 6 heures' },
  { value: 12 * 3600, label: 'Toutes les 12 heures' },
  { value: 86_400, label: 'Tous les jours' },
  { value: 7 * 86_400, label: 'Toutes les semaines' },
]

onMounted(async () => {
  try {
    settings.value = await get<BoosterSettings>('admin/settings')
    saved.value = JSON.stringify(settings.value)
  } catch (err) {
    toast.error(errorMessage(err))
  }
})

const presets = computed(() => {
  const current = settings.value?.intervalSeconds
  if (!current || PRESETS.some((p) => p.value === current)) return PRESETS
  return [...PRESETS, { value: current, label: `Toutes les ${Math.round(current / 60)} minutes` }]
})

const dirty = computed(() => !!settings.value && JSON.stringify(settings.value) !== saved.value)

async function save() {
  if (!settings.value) return
  saving.value = true
  try {
    settings.value = await put<BoosterSettings>('admin/settings', settings.value)
    saved.value = JSON.stringify(settings.value)
    toast.show('Réglages enregistrés')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    saving.value = false
  }
}

async function giftAll(request: Required<GiftBoostersRequest>) {
  const n = request.count
  if (!confirm(`Offrir ${n} booster${n > 1 ? 's' : ''} à chaque joueur ?`)) return
  gifting.value = true
  try {
    const { players } = await post<{ players: number }>('admin/boosters/gift-all', request)
    giftForm.value?.reset()
    toast.show(
      `${n} booster${n > 1 ? 's' : ''} offert${n > 1 ? 's' : ''} à ${players} joueur${players > 1 ? 's' : ''}`,
    )
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    gifting.value = false
  }
}
</script>

<template>
  <div class="page">
    <section class="block">
      <h2>Boosters gratuits</h2>

      <form v-if="settings" class="form" @submit.prevent="save">
        <div class="field">
          <label for="settings-interval">Fréquence</label>
          <select id="settings-interval" v-model.number="settings.intervalSeconds" class="select">
            <option v-for="p in presets" :key="p.value" :value="p.value">{{ p.label }}</option>
          </select>
        </div>
        <div class="field">
          <label for="settings-stock">Réserve maximale</label>
          <input
            id="settings-stock"
            v-model.number="settings.maxStock"
            class="input"
            type="number"
            min="1"
            max="50"
            required
          />
        </div>
        <div class="field">
          <label for="settings-size">Cartes par booster</label>
          <input
            id="settings-size"
            v-model.number="settings.size"
            class="input"
            type="number"
            min="1"
            max="15"
            required
          />
        </div>
        <button class="btn btn-primary" type="submit" :disabled="!dirty || saving">
          <Save /> Enregistrer
        </button>
      </form>
      <p v-else class="muted">Chargement…</p>
    </section>

    <section class="block">
      <h2>Offrir des boosters</h2>
      <p class="muted">
        Pour chaque compte actif, sans expiration. Pour un seul joueur : page Joueurs.
      </p>
      <GiftForm
        ref="giftForm"
        id-prefix="gift-all"
        submit-label="Offrir à tous les joueurs"
        :busy="gifting"
        @submit="giftAll"
      />
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

.block {
  padding: var(--space-5) 0;
  border-top: 1px solid var(--line);
}

.block:first-child {
  padding-top: 0;
  border-top: 0;
}

.block h2 {
  font-size: 26px;
  font-weight: 500;
}

.block > .muted {
  max-width: 560px;
  margin: var(--space-1) 0 var(--space-4);
}

.form {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr auto;
  align-items: end;
  gap: var(--space-3);
}

.form .field {
  margin: 0;
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .form {
    grid-template-columns: 1fr;
  }
}
</style>
