<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'

const props = defineProps<{ open: boolean; title: string; width?: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement>()

function sync() {
  const el = dialog.value
  if (!el) return
  if (props.open && !el.open) el.showModal()
  else if (!props.open && el.open) el.close()
}

watch(() => props.open, sync)
onMounted(sync)

function onBackdrop(e: MouseEvent) {
  if (e.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    :style="{ width: width ?? '480px' }"
    @close="emit('close')"
    @click="onBackdrop"
  >
    <div class="panel">
      <header class="head">
        <h2>{{ title }}</h2>
        <button class="btn btn-ghost btn-icon" type="button" aria-label="Fermer" @click="emit('close')">
          <X />
        </button>
      </header>
      <div class="body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="foot">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  max-width: calc(100vw - 32px);
  padding: 0;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-lg);
}

.dialog::backdrop {
  background: rgb(29 27 24 / 0.35);
  backdrop-filter: blur(2px);
}

.dialog[open] {
  animation: rise 0.18s ease-out;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-4) var(--space-3) var(--space-5);
  border-bottom: 1px solid var(--line);
}

.head h2 {
  font-size: 24px;
}

.body {
  padding: var(--space-5);
}

.foot {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-5) var(--space-4);
  border-top: 1px solid var(--line);
  background: var(--paper);
  border-radius: 0 0 var(--radius-lg) var(--radius-lg);
}
</style>
