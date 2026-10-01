<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Copy,
  ImagePlus,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-vue-next'
import { RARITY_INFO, RARITY_LIST } from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useEditor } from '@/composables/editor'
import { useToast } from '@/composables/useToast'
import { uploadImage } from '@/lib/upload'
import ColorField from '@/components/ui/ColorField.vue'
import NumberField from '@/components/ui/NumberField.vue'

const store = useCardsStore()
const toast = useToast()
const { draft, selected, selectedLayer, removeLayer, duplicateLayer } = useEditor()

const card = computed(() => draft.value)

const number = computed({
  get: () => draft.value.number ?? '',
  set: (v: number | string) => {
    draft.value.number = v === '' || Number.isNaN(Number(v)) ? null : Math.max(0, Math.round(Number(v)))
  },
})

function autoNumber() {
  const others = store.cards.filter((c) => c.id !== draft.value.id)
  const numbers = others
    .filter((c) => c.categoryId === draft.value.categoryId && c.number != null)
    .map((c) => c.number!)
  draft.value.number = numbers.length ? Math.max(...numbers) + 1 : 1
}

const dragging = ref(false)

async function setPhoto(file?: File | null) {
  try {
    const image = await uploadImage(file)
    if (image) draft.value.photo = { imageId: image.id, x: 50, y: 50, scale: 1 }
  } catch (err) {
    console.error(err)
    toast.error('Impossible de lire cette image.')
  }
}

function onDropPhoto(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files[0]
  if (file?.type.startsWith('image/')) setPhoto(file)
}

async function replaceLayerImage() {
  const layer = selectedLayer.value
  if (layer?.type !== 'image') return
  const image = await uploadImage()
  if (image) layer.imageId = image.id
}

const WEIGHTS = [
  { value: 400, label: 'Normal' },
  { value: 500, label: 'Moyen' },
  { value: 600, label: 'Demi-gras' },
  { value: 700, label: 'Gras' },
] as const
</script>

<template>
  <div class="panel">
    <!-- Champs de la carte -->
    <template v-if="selected === 'card'">
      <header>
        <p class="eyebrow">Carte</p>
        <h3>Informations</h3>
      </header>

      <div class="field">
        <label for="card-name">Nom</label>
        <input id="card-name" v-model="card.name" class="input" maxlength="120" placeholder="Prénom Nom ou nom de l'événement" />
      </div>
      <div class="field">
        <label for="card-subtitle">Sous-titre</label>
        <input id="card-subtitle" v-model="card.subtitle" class="input" maxlength="160" placeholder="Poste, date, lieu…" />
      </div>
      <div class="field">
        <label for="card-desc">Description</label>
        <textarea id="card-desc" v-model="card.description" class="textarea" maxlength="1000" rows="4" placeholder="Une phrase d'ambiance, une anecdote…" />
        <span class="counter muted">{{ card.description.length }} / 220 conseillés</span>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="card-cat">Collection</label>
          <select id="card-cat" v-model="card.categoryId" class="select">
            <option :value="null">Aucune</option>
            <option v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="field">
          <label for="card-number">Numéro</label>
          <div class="row">
            <input id="card-number" v-model="number" class="input" type="number" min="0" max="9999" placeholder="—" />
            <button class="btn btn-icon" type="button" title="Numéro suivant dans la collection" @click="autoNumber">
              <Wand2 />
            </button>
          </div>
        </div>
      </div>
      <RouterLink to="/collections" class="manage muted">Gérer les collections →</RouterLink>

      <div class="field">
        <span class="label">Rareté</span>
        <div class="rarities">
          <button
            v-for="r in RARITY_LIST"
            :key="r"
            type="button"
            class="rarity"
            :class="{ active: card.rarity === r }"
            :style="{ '--c': RARITY_INFO[r].color }"
            @click="card.rarity = r"
          >
            <i />{{ RARITY_INFO[r].label }}
          </button>
        </div>
      </div>
    </template>

    <!-- Photo principale -->
    <template v-else-if="selected === 'photo'">
      <header>
        <p class="eyebrow">Carte</p>
        <h3>Photo</h3>
      </header>

      <button
        type="button"
        class="drop"
        :class="{ dragging }"
        @click="setPhoto()"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="onDropPhoto"
      >
        <ImagePlus />
        <span>{{ card.photo.imageId ? 'Remplacer la photo' : 'Choisir une photo' }}</span>
        <span class="muted drop-hint">ou déposez une image ici</span>
      </button>

      <template v-if="card.photo.imageId">
        <div class="field">
          <span class="label">Zoom · {{ Math.round(card.photo.scale * 100) }} %</span>
          <input v-model.number="card.photo.scale" type="range" min="1" max="5" step="0.01" />
        </div>
        <div class="field">
          <span class="label">Cadrage horizontal</span>
          <input v-model.number="card.photo.x" type="range" min="0" max="100" step="0.5" />
        </div>
        <div class="field">
          <span class="label">Cadrage vertical</span>
          <input v-model.number="card.photo.y" type="range" min="0" max="100" step="0.5" />
        </div>
        <div class="row">
          <button class="btn btn-sm" type="button" @click="Object.assign(card.photo, { x: 50, y: 50, scale: 1 })">
            <RotateCcw /> Recentrer
          </button>
          <button class="btn btn-sm btn-danger" type="button" @click="card.photo.imageId = null">
            <Trash2 /> Retirer
          </button>
        </div>
        <p class="muted tip">
          Astuce : glissez directement sur la photo pour la recadrer, molette ou pincement pour zoomer.
        </p>
      </template>
    </template>

    <!-- Calque libre -->
    <template v-else-if="selectedLayer">
      <header>
        <p class="eyebrow">
          {{ { text: 'Texte', image: 'Image', shape: 'Forme' }[selectedLayer.type] }}
        </p>
        <input v-model="selectedLayer.name" class="title-input" maxlength="80" aria-label="Nom du calque" />
      </header>

      <template v-if="selectedLayer.type === 'text'">
        <div class="field">
          <label for="layer-text">Texte</label>
          <textarea id="layer-text" v-model="selectedLayer.text" class="textarea" rows="3" />
        </div>
        <div class="grid-2">
          <div class="field">
            <span class="label">Police</span>
            <div class="segmented">
              <button type="button" class="serif" :class="{ active: selectedLayer.font === 'serif' }" @click="selectedLayer.font = 'serif'">Serif</button>
              <button type="button" :class="{ active: selectedLayer.font === 'sans' }" @click="selectedLayer.font = 'sans'">Sans</button>
            </div>
          </div>
          <NumberField v-model="selectedLayer.size" label="Taille" :min="4" :max="400" suffix="px" />
        </div>
        <div class="grid-2">
          <div class="field">
            <label for="layer-weight">Graisse</label>
            <select id="layer-weight" v-model.number="selectedLayer.weight" class="select">
              <option v-for="w in WEIGHTS" :key="w.value" :value="w.value">{{ w.label }}</option>
            </select>
          </div>
          <div class="field">
            <span class="label">Alignement</span>
            <div class="segmented">
              <button type="button" title="Gauche" :class="{ active: selectedLayer.align === 'left' }" @click="selectedLayer.align = 'left'"><AlignLeft /></button>
              <button type="button" title="Centre" :class="{ active: selectedLayer.align === 'center' }" @click="selectedLayer.align = 'center'"><AlignCenter /></button>
              <button type="button" title="Droite" :class="{ active: selectedLayer.align === 'right' }" @click="selectedLayer.align = 'right'"><AlignRight /></button>
            </div>
          </div>
        </div>
        <div class="grid-2">
          <NumberField v-model="selectedLayer.letterSpacing" label="Interlettrage" :min="-0.2" :max="1" :step="0.01" suffix="em" />
          <div class="field">
            <span class="label">Style</span>
            <div class="checks">
              <label><input v-model="selectedLayer.italic" type="checkbox" /> Italique</label>
              <label><input v-model="selectedLayer.uppercase" type="checkbox" /> Capitales</label>
            </div>
          </div>
        </div>
        <ColorField v-model="selectedLayer.color" label="Couleur" />
      </template>

      <template v-else-if="selectedLayer.type === 'image'">
        <button class="btn btn-sm" type="button" @click="replaceLayerImage"><ImagePlus /> Remplacer l’image</button>
        <div class="grid-2">
          <div class="field">
            <span class="label">Ajustement</span>
            <div class="segmented">
              <button type="button" :class="{ active: selectedLayer.fit === 'contain' }" @click="selectedLayer.fit = 'contain'">Contenir</button>
              <button type="button" :class="{ active: selectedLayer.fit === 'cover' }" @click="selectedLayer.fit = 'cover'">Remplir</button>
            </div>
          </div>
          <NumberField v-model="selectedLayer.radius" label="Arrondi" :min="0" :max="50" suffix="px" />
        </div>
      </template>

      <template v-else-if="selectedLayer.type === 'shape'">
        <template v-if="selectedLayer.shape === 'line'">
          <ColorField v-model="selectedLayer.stroke" label="Couleur" />
          <NumberField v-model="selectedLayer.strokeWidth" label="Épaisseur" :min="1" :max="100" suffix="px" />
        </template>
        <template v-else>
          <ColorField v-model="selectedLayer.fill" label="Remplissage" allow-none />
          <ColorField v-model="selectedLayer.stroke" label="Contour" allow-none />
          <div class="grid-2">
            <NumberField v-model="selectedLayer.strokeWidth" label="Épaisseur" :min="0" :max="100" suffix="px" />
            <NumberField v-if="selectedLayer.shape === 'rect'" v-model="selectedLayer.radius" label="Arrondi" :min="0" :max="50" suffix="px" />
          </div>
        </template>
      </template>

      <hr />
      <p class="label">Position & taille</p>
      <div class="grid-2">
        <NumberField v-model="selectedLayer.x" label="X" :step="0.5" suffix="%" />
        <NumberField v-model="selectedLayer.y" label="Y" :step="0.5" suffix="%" />
        <NumberField v-model="selectedLayer.w" label="Largeur" :min="0" :step="0.5" suffix="%" />
        <NumberField v-model="selectedLayer.h" label="Hauteur" :min="0" :step="0.5" suffix="%" />
        <NumberField v-model="selectedLayer.rotation" label="Rotation" :min="-360" :max="360" suffix="°" />
        <div class="field">
          <span class="label">Opacité · {{ Math.round(selectedLayer.opacity * 100) }} %</span>
          <input v-model.number="selectedLayer.opacity" type="range" min="0" max="1" step="0.01" />
        </div>
      </div>

      <div class="row actions">
        <button class="btn btn-sm" type="button" @click="duplicateLayer(selectedLayer.id)"><Copy /> Dupliquer</button>
        <button class="btn btn-sm btn-danger" type="button" @click="removeLayer(selectedLayer.id)"><Trash2 /> Supprimer</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-5) var(--space-7);
}

header h3 {
  font-size: 26px;
  font-weight: 500;
}

.title-input {
  width: 100%;
  padding: 0;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  font: 500 26px var(--font-serif);
  color: var(--ink);
}

.title-input:hover,
.title-input:focus {
  outline: none;
  border-bottom-color: var(--line-strong);
}

.counter {
  align-self: flex-end;
  font-size: 11px;
}

.manage {
  margin-top: calc(-1 * var(--space-2));
  font-size: 12px;
  text-decoration: none;
}

.manage:hover {
  color: var(--ink);
}

.rarities {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.rarity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  height: 34px;
  padding: 0 var(--space-3);
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: transparent;
  font: 500 13px var(--font-sans);
  color: var(--ink-2);
  cursor: pointer;
  text-align: left;
}

.rarity i {
  width: 10px;
  height: 10px;
  transform: rotate(45deg);
  background: var(--c);
}

.rarity:hover {
  background: var(--paper-2);
}

.rarity.active {
  border-color: var(--c);
  background: var(--surface);
  color: var(--ink);
}

.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-5);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--paper);
  font: 500 13px var(--font-sans);
  color: var(--ink);
  cursor: pointer;
}

.drop .muted {
  font-weight: 400;
  font-size: 12px;
}

.drop svg {
  width: 24px;
  height: 24px;
  color: var(--accent);
}

.drop:hover,
.drop.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.tip {
  font-size: 12px;
}

.segmented .serif {
  font-family: var(--font-serif);
  font-size: 15px;
}

.checks {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 13px;
}

.checks label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

hr {
  width: 100%;
  margin: var(--space-1) 0;
  border: 0;
  border-top: 1px solid var(--line);
}

.actions {
  margin-top: var(--space-2);
}

@media (pointer: coarse) {
  .drop-hint {
    display: none;
  }
}

@media (max-width: 860px) {
  .panel {
    padding: var(--space-4) var(--space-4) var(--space-6);
  }

  /* Le titre est déjà dans l'onglet ; on garde seulement le nom éditable d'un calque. */
  header .eyebrow,
  header h3 {
    display: none;
  }

  .title-input {
    font-size: 22px;
  }

  .rarities {
    flex-direction: row;
    flex-wrap: wrap;
    gap: var(--space-1);
  }

  .rarity {
    border-color: var(--line);
    background: var(--surface);
  }

  .drop {
    padding: var(--space-4);
  }
}
</style>
