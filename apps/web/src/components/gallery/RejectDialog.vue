<!-- Refus de propositions de joueurs, avec un motif qui leur est montré et notifié. -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Ban } from 'lucide-vue-next'
import { REVIEW_NOTE_MAX } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const props = defineProps<{ open: boolean; ids: string[] }>()
const emit = defineEmits<{ close: []; done: [] }>()

const store = useCardsStore()
const toast = useToast()
const note = ref('')
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) note.value = ''
  },
)

/** Seules les propositions de joueurs encore en brouillon peuvent être refusées. */
const proposals = computed(() =>
  props.ids.filter((id) => {
    const info = store.infoOf(id)
    return !!info?.createdBy && info.status === 'draft'
  }),
)
const ignored = computed(() => props.ids.length - proposals.value.length)

async function submit() {
  busy.value = true
  try {
    const n = await store.rejectCards(proposals.value, note.value)
    toast.show(`${n} proposition${n > 1 ? 's' : ''} refusée${n > 1 ? 's' : ''}`)
    emit('done')
    emit('close')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <BaseDialog :open="open" title="Refuser des propositions" @close="emit('close')">
    <form id="reject-form" @submit.prevent="submit">
      <p class="muted intro">
        {{ proposals.length }} proposition{{ proposals.length > 1 ? 's' : '' }} de joueurs.
        <template v-if="ignored">
          {{ ignored }} autre{{ ignored > 1 ? 's' : '' }} carte{{ ignored > 1 ? 's' : '' }} (admin
          ou déjà publiée{{ ignored > 1 ? 's' : '' }}) ignorée{{ ignored > 1 ? 's' : '' }}.
        </template>
        Elles restent en brouillon : vous pouvez encore les modifier et les publier.
      </p>
      <div class="field">
        <label for="reject-note">Motif (montré au joueur)</label>
        <textarea
          id="reject-note"
          v-model="note"
          class="textarea"
          rows="3"
          :maxlength="REVIEW_NOTE_MAX"
          placeholder="Photo trop floue, carte en double…"
        />
      </div>
    </form>
    <template #footer>
      <button class="btn btn-ghost" type="button" @click="emit('close')">Annuler</button>
      <button
        class="btn btn-danger"
        type="submit"
        form="reject-form"
        :disabled="busy || !proposals.length"
      >
        <Ban /> Refuser
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.intro {
  margin-bottom: var(--space-4);
}
</style>
