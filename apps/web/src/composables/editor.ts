import { computed, inject, provide, ref, type InjectionKey, type Ref } from 'vue'
import {
  createImageLayer,
  createShapeLayer,
  createTextLayer,
  newId,
  type Card,
  type Layer,
  type ShapeLayer,
} from '@axomaster/card-model'
import { clone } from '@/lib/clone'

/** Élément sélectionné dans l'éditeur : la carte (champs de base), sa photo, ou un calque libre. */
export type Selection = 'card' | 'photo' | string

const SHAPE_NAMES: Record<ShapeLayer['shape'], string> = {
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Ligne',
}

/**
 * @param checkpoint appelé avant chaque modification structurelle (ajout, suppression,
 * réordonnancement de calque) pour qu'elle forme sa propre étape d'annulation.
 */
function createEditor(draft: Ref<Card>, checkpoint: () => void) {
  const selected = ref<Selection>('card')

  const selectedLayer = computed<Layer | null>(
    () => draft.value.layers.find((l) => l.id === selected.value) ?? null,
  )

  function nextName(base: string) {
    const count = draft.value.layers.filter((l) => l.name.startsWith(base)).length
    return `${base} ${count + 1}`
  }

  function push(layer: Layer) {
    checkpoint()
    draft.value.layers.push(layer)
    selected.value = layer.id
    return layer
  }

  function addText() {
    return push(createTextLayer(nextName('Texte')))
  }

  function addImage(imageId: string, ratio: number) {
    const layer = createImageLayer(imageId, nextName('Image'))
    // Conserve les proportions de l'image (la carte fait 630 × 880).
    layer.h = Math.min(60, (layer.w * 630) / 880 / ratio)
    layer.y = 50 - layer.h / 2
    return push(layer)
  }

  function addShape(shape: ShapeLayer['shape']) {
    return push(createShapeLayer(shape, nextName(SHAPE_NAMES[shape])))
  }

  function indexOf(id: string) {
    return draft.value.layers.findIndex((l) => l.id === id)
  }

  function removeLayer(id: string) {
    const index = indexOf(id)
    if (index === -1) return
    checkpoint()
    draft.value.layers.splice(index, 1)
    if (selected.value === id) selected.value = 'card'
  }

  function duplicateLayer(id: string) {
    const index = indexOf(id)
    const source = draft.value.layers[index]
    if (!source) return
    checkpoint()
    const copy = { ...clone(source), id: newId(), name: `${source.name} (copie)` }
    copy.x += 2
    copy.y += 2
    draft.value.layers.splice(index + 1, 0, copy)
    selected.value = copy.id
  }

  /** Déplace un calque dans la pile : +1 = vers le haut (devant), -1 = vers le bas. */
  function moveLayer(id: string, delta: number) {
    const layers = draft.value.layers
    const from = indexOf(id)
    const to = from + delta
    if (from === -1 || to < 0 || to >= layers.length) return
    checkpoint()
    const [layer] = layers.splice(from, 1)
    layers.splice(to, 0, layer!)
  }

  return {
    draft,
    selected,
    selectedLayer,
    addText,
    addImage,
    addShape,
    removeLayer,
    duplicateLayer,
    moveLayer,
  }
}

export type EditorState = ReturnType<typeof createEditor>

const KEY: InjectionKey<EditorState> = Symbol('editor')

export function provideEditor(draft: Ref<Card>, checkpoint: () => void = () => {}) {
  const editor = createEditor(draft, checkpoint)
  provide(KEY, editor)
  return editor
}

export function useEditor() {
  const editor = inject(KEY)
  if (!editor) throw new Error('useEditor() doit être appelé sous un éditeur')
  return editor
}
