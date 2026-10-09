<!-- Aperçu d'une notification push, à la manière d'une notification système. -->
<script setup lang="ts">
import type { NotificationPayload } from '@axomaster/card-model'
import AxoX from '@/components/brand/AxoX.vue'

defineProps<{ payload: NotificationPayload }>()
</script>

<template>
  <figure class="preview" aria-label="Aperçu de la notification">
    <span class="icon"><AxoX gradient="violet" /></span>
    <div class="content">
      <p class="meta">AxoMaster · maintenant</p>
      <p class="title">{{ payload.title }}</p>
      <p class="body">{{ payload.body }}</p>
    </div>
  </figure>
</template>

<style scoped>
.preview {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
  margin: 0;
  padding: var(--space-3) var(--space-4);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: var(--shadow);
}

.icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  padding: 9px 10px;
  background: var(--night);
  border-radius: 9px;
}

.content {
  min-width: 0;
}

.meta {
  font-size: 12px;
  color: var(--ink-3);
}

.title {
  margin-top: 2px;
  font-size: 14px;
  font-weight: 600;
  color: var(--ink);
}

.body {
  margin-top: 1px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--ink-2);
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 4;
  line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
