<script setup lang="ts">
const props = withDefaults(
  defineProps<{ label: string; min?: number; max?: number; step?: number; suffix?: string }>(),
  { min: undefined, max: undefined, step: 1, suffix: '' },
)
const model = defineModel<number>({ required: true })

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).valueAsNumber
  if (Number.isNaN(value)) return
  let next = value
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  model.value = next
}
</script>

<template>
  <label class="field">
    <span class="label">{{ label }}</span>
    <span class="wrap">
      <input
        class="input"
        type="number"
        :value="Math.round(model * 100) / 100"
        :min="min"
        :max="max"
        :step="step"
        @input="onInput"
      />
      <span v-if="suffix" class="suffix">{{ suffix }}</span>
    </span>
  </label>
</template>

<style scoped>
.wrap {
  position: relative;
}

.input {
  padding-right: 26px;
}

.suffix {
  position: absolute;
  right: 10px;
  top: 50%;
  translate: 0 -50%;
  font-size: 12px;
  color: var(--ink-3);
  pointer-events: none;
}
</style>
