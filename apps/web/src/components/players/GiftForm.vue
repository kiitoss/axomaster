<!-- Offrir des boosters : nombre, message de la notification et aperçu en direct. -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { BellRing, Gift } from 'lucide-vue-next'
import { GIFT_MESSAGE_MAX, giftNotification, type GiftBoostersRequest } from '@axomaster/card-model'
import { usePush } from '@/composables/usePush'
import { useToast } from '@/composables/useToast'
import NotificationPreview from './NotificationPreview.vue'

const props = defineProps<{
  /** Préfixe des identifiants de champs (plusieurs formulaires peuvent coexister). */
  idPrefix: string
  submitLabel: string
  busy?: boolean
}>()

const emit = defineEmits<{ submit: [request: Required<GiftBoostersRequest>] }>()

const push = usePush()
const toast = useToast()

const count = ref(1)
const message = ref('')

/** Même construction que le serveur : l'aperçu est fidèle. */
const payload = computed(() => giftNotification(count.value || 1, message.value))

function submit() {
  emit('submit', { count: count.value, message: message.value.trim() })
}

async function testHere() {
  if (await push.showLocal(payload.value)) toast.show('Notification de test affichée')
  else toast.error('Activez d’abord les notifications sur cet appareil (cloche en haut).')
}

defineExpose({
  reset() {
    count.value = 1
    message.value = ''
  },
})
</script>

<template>
  <form class="gift-form" @submit.prevent="submit">
    <div class="fields">
      <div class="field">
        <label :for="`${idPrefix}-count`">Nombre de boosters</label>
        <input
          :id="`${idPrefix}-count`"
          v-model.number="count"
          class="input count"
          type="number"
          min="1"
          max="20"
          required
        />
      </div>
      <div class="field">
        <label :for="`${idPrefix}-message`">Message de la notification</label>
        <textarea
          :id="`${idPrefix}-message`"
          v-model="message"
          class="textarea"
          rows="3"
          :maxlength="GIFT_MESSAGE_MAX"
          placeholder="Facultatif : un mot pour accompagner le cadeau"
        />
        <span class="counter muted">{{ message.length }} / {{ GIFT_MESSAGE_MAX }}</span>
      </div>
    </div>

    <div class="aside">
      <p class="label">Aperçu</p>
      <NotificationPreview :payload="payload" />
      <button
        v-if="push.available.value && push.permission.value === 'granted'"
        class="btn btn-ghost btn-sm test"
        type="button"
        @click="testHere"
      >
        <BellRing /> Tester sur cet appareil
      </button>
    </div>

    <div class="submit">
      <button class="btn btn-primary" type="submit" :disabled="props.busy">
        <Gift /> {{ submitLabel }}
      </button>
    </div>
  </form>
</template>

<style scoped>
.gift-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-4) var(--space-5);
  align-items: start;
}

.fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.fields .field {
  margin: 0;
}

.count {
  max-width: 140px;
}

.counter {
  align-self: flex-end;
  font-size: 12px;
}

.aside {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.test {
  align-self: flex-start;
}

.submit {
  grid-column: 1 / -1;
}

@media (max-width: 860px) {
  .gift-form {
    grid-template-columns: 1fr;
  }

  .submit .btn {
    width: 100%;
  }
}
</style>
