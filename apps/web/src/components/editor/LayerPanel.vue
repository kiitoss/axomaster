<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Eye,
  EyeOff,
  Image as ImageIcon,
  LayoutTemplate,
  Lock,
  LockOpen,
  Minus,
  Square,
  Trash2,
  Type,
  UserSquare,
} from 'lucide-vue-next'
import type { Layer } from '@axomaster/card-model'
import { useEditor } from '@/composables/editor'
import { useToast } from '@/composables/useToast'
import { uploadImage } from '@/lib/upload'

const { draft, selected, addText, addImage, addShape, removeLayer, moveLayer } = useEditor()
const toast = useToast()

/** Calques affichés du plus haut (devant) au plus bas. */
const stack = computed(() => [...draft.value.layers].reverse())

function iconFor(layer: Layer) {
  if (layer.type === 'text') return Type
  if (layer.type === 'image') return ImageIcon
  return { rect: Square, ellipse: Circle, line: Minus }[layer.shape]
}

async function onAddImage() {
  try {
    const image = await uploadImage()
    if (image) addImage(image.id, image.ratio)
  } catch (err) {
    console.error(err)
    toast.error("Impossible de lire cette image.")
  }
}
</script>

<template>
  <div class="panel">
    <section>
      <h3 class="label">Ajouter</h3>
      <div class="add">
        <button class="btn btn-sm" type="button" @click="addText"><Type /> Texte</button>
        <button class="btn btn-sm" type="button" @click="onAddImage"><ImageIcon /> Image</button>
        <button class="btn btn-sm" type="button" title="Rectangle" @click="addShape('rect')"><Square /></button>
        <button class="btn btn-sm" type="button" title="Ellipse" @click="addShape('ellipse')"><Circle /></button>
        <button class="btn btn-sm" type="button" title="Ligne" @click="addShape('line')"><Minus /></button>
      </div>
    </section>

    <section class="layers">
      <h3 class="label">Calques</h3>
      <ul>
        <li
          v-for="(layer, i) in stack"
          :key="layer.id"
          class="item"
          :class="{ active: selected === layer.id, hidden: !layer.visible }"
          @click="selected = layer.id"
        >
          <component :is="iconFor(layer)" class="icon" />
          <span class="name">{{ layer.name }}</span>
          <span class="tools">
            <button
              class="btn btn-ghost btn-icon btn-sm"
              type="button"
              title="Monter"
              :disabled="i === 0"
              @click.stop="moveLayer(layer.id, 1)"
            >
              <ArrowUp />
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              type="button"
              title="Descendre"
              :disabled="i === stack.length - 1"
              @click.stop="moveLayer(layer.id, -1)"
            >
              <ArrowDown />
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              type="button"
              :title="layer.locked ? 'Déverrouiller' : 'Verrouiller'"
              @click.stop="layer.locked = !layer.locked"
            >
              <Lock v-if="layer.locked" />
              <LockOpen v-else />
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              type="button"
              :title="layer.visible ? 'Masquer' : 'Afficher'"
              @click.stop="layer.visible = !layer.visible"
            >
              <Eye v-if="layer.visible" />
              <EyeOff v-else />
            </button>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              type="button"
              title="Supprimer"
              @click.stop="removeLayer(layer.id)"
            >
              <Trash2 />
            </button>
          </span>
        </li>

        <li v-if="!stack.length" class="empty muted">
          Ajoutez des textes, images ou formes par-dessus la carte.
        </li>

        <li class="divider" aria-hidden="true" />

        <li class="item base" :class="{ active: selected === 'photo' }" @click="selected = 'photo'">
          <UserSquare class="icon" />
          <span class="name">Photo</span>
        </li>
        <li class="item base" :class="{ active: selected === 'card' }" @click="selected = 'card'">
          <LayoutTemplate class="icon" />
          <span class="name">Carte</span>
          <span class="muted tag">textes, rareté</span>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
  padding: var(--space-5) var(--space-4);
}

section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.add {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: 36px;
  padding: 0 var(--space-1) 0 var(--space-3);
  border-radius: var(--radius);
  cursor: pointer;
  color: var(--ink-2);
}

.item:hover {
  background: var(--paper-2);
}

.item.active {
  background: var(--surface);
  color: var(--ink);
  box-shadow: inset 0 0 0 1px var(--line-strong);
}

.item.hidden .name,
.item.hidden .icon {
  opacity: 0.45;
}

.icon {
  flex: none;
  width: 15px;
  height: 15px;
  color: var(--ink-3);
}

.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.tag {
  font-size: 11px;
  padding-right: var(--space-2);
}

.tools {
  display: flex;
  opacity: 0;
  transition: opacity 0.12s;
}

.item:hover .tools,
.item.active .tools {
  opacity: 1;
}

/* Pas de survol au doigt : outils toujours visibles, lignes plus hautes. */
@media (pointer: coarse) {
  .tools {
    opacity: 1;
  }

  .item {
    height: 46px;
  }
}

@media (max-width: 860px) {
  .panel {
    gap: var(--space-4);
    padding: var(--space-4);
  }
}

.tools .btn {
  color: var(--ink-3);
}

.tools .btn:hover {
  color: var(--ink);
}

.divider {
  height: 1px;
  margin: var(--space-2) var(--space-2);
  background: var(--line);
}

.empty {
  padding: var(--space-2) var(--space-3);
  font-size: 12px;
}
</style>
