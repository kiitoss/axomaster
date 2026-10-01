<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{ label: string; allowNone?: boolean }>()
const model = defineModel<string>({ required: true })

const isNone = computed(() => model.value === 'transparent')
const hex = computed(() => (/^#[0-9a-f]{6}$/i.test(model.value) ? model.value : '#000000'))

function toggleNone(e: Event) {
  model.value = (e.target as HTMLInputElement).checked ? 'transparent' : '#1d1b18'
}

const id = useId()
</script>

<template>
  <div class="field">
    <label :for="id">{{ props.label }}</label>
    <div class="row">
      <input :id="id" type="color" :value="hex" :disabled="isNone" @input="model = ($event.target as HTMLInputElement).value" />
      <input v-model.lazy="model" class="input mono" :disabled="isNone" spellcheck="false" />
      <label v-if="allowNone" class="none">
        <input type="checkbox" :checked="isNone" @change="toggleNone" /> Aucune
      </label>
    </div>
  </div>
</template>

<style scoped>
.mono {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 12px;
}

.none {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--ink-2);
  white-space: nowrap;
  cursor: pointer;
}

input[type='color']:disabled,
.input:disabled {
  opacity: 0.4;
}
</style>
