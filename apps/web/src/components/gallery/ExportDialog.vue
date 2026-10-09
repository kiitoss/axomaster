<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Card } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { downloadJson, slugify, today } from '@/lib/download'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const props = defineProps<{ open: boolean; filtered: Card[] }>()
const emit = defineEmits<{ close: [] }>()

const store = useCardsStore()
const toast = useToast()

type Scope = 'all' | 'filtered' | 'mine'
const scope = ref<Scope>('all')
const busy = ref(false)

const selection = computed<Record<Scope, Card[]>>(() => ({
  all: store.cards,
  filtered: props.filtered,
  mine: store.cards.filter((c) => c.source.kind === 'local'),
}))

const count = computed(() => selection.value[scope.value].length)

async function confirmExport() {
  busy.value = true
  try {
    const pack = await store.exportPack(selection.value[scope.value])
    downloadJson(pack, `axomaster-${slugify(store.authorName)}-${today()}.json`)
    toast.show(
      `${pack.cards.length} carte${pack.cards.length > 1 ? 's' : ''} exportée${pack.cards.length > 1 ? 's' : ''}`,
    )
    emit('close')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog :open="open" title="Exporter un paquet" @close="emit('close')">
    <p class="muted intro">
      Le fichier contient les cartes et leurs images. Envoyez-le à vos collègues : ils l’importeront
      depuis leur galerie d’administration.
    </p>

    <p class="muted">
      Signé par <strong>{{ store.authorName }}</strong
      >.
    </p>

    <fieldset class="scope">
      <legend class="label">Cartes à exporter</legend>
      <label>
        <input v-model="scope" type="radio" value="all" />
        Toute la collection <span class="muted">({{ selection.all.length }})</span>
      </label>
      <label>
        <input v-model="scope" type="radio" value="filtered" />
        Les cartes affichées (filtres actuels)
        <span class="muted">({{ selection.filtered.length }})</span>
      </label>
      <label>
        <input v-model="scope" type="radio" value="mine" />
        Seulement celles créées ici <span class="muted">({{ selection.mine.length }})</span>
      </label>
    </fieldset>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="!count || busy"
        @click="confirmExport"
      >
        {{ busy ? 'Préparation…' : `Télécharger (${count})` }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.intro {
  margin-bottom: var(--space-4);
}

.scope {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.scope label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
</style>
