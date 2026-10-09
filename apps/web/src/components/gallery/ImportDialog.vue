<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileJson } from 'lucide-vue-next'
import { parsePack, type CardPack } from '@axomaster/card-model'
import { useCardsStore, type DuplicateStrategy } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import { errorMessage } from '@/api/client'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useCardsStore()
const toast = useToast()

const pack = ref<CardPack | null>(null)
const fileName = ref('')
const error = ref('')
const strategy = ref<DuplicateStrategy>('skip')
const dragging = ref(false)
const busy = ref(false)

watch(
  () => props.open,
  (open) => {
    if (open) {
      pack.value = null
      error.value = ''
      fileName.value = ''
      strategy.value = 'skip'
    }
  },
)

const duplicates = computed(() => (pack.value ? store.countDuplicates(pack.value) : 0))
const newCategories = computed(
  () => pack.value?.categories.filter((c) => !store.getCategory(c.id)) ?? [],
)

async function readFile(file: File | undefined) {
  if (!file) return
  fileName.value = file.name
  const result = parsePack(await file.text())
  if (result.ok) {
    pack.value = result.pack
    error.value = ''
  } else {
    pack.value = null
    error.value = result.error
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  readFile(e.dataTransfer?.files[0])
}

function onPick(e: Event) {
  readFile((e.target as HTMLInputElement).files?.[0])
  ;(e.target as HTMLInputElement).value = ''
}

async function confirmImport() {
  if (!pack.value) return
  busy.value = true
  try {
    const report = await store.importPack(pack.value, strategy.value)
    const parts = [`${report.added} ajoutée${report.added > 1 ? 's' : ''}`]
    if (report.replaced) parts.push(`${report.replaced} remplacée${report.replaced > 1 ? 's' : ''}`)
    if (report.skipped) parts.push(`${report.skipped} ignorée${report.skipped > 1 ? 's' : ''}`)
    toast.show(`Import terminé : ${parts.join(', ')}`)
    emit('close')
  } catch (err) {
    console.error(err)
    toast.error(`L'import a échoué : ${errorMessage(err)}`)
  } finally {
    busy.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
</script>

<template>
  <BaseDialog :open="open" title="Importer un paquet" @close="emit('close')">
    <label
      class="drop"
      :class="{ dragging, loaded: pack }"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <FileJson />
      <span v-if="fileName" class="file">{{ fileName }}</span>
      <span v-else class="drop-desktop"
        >Déposez un fichier <code>.json</code> ici<br /><span class="muted"
          >ou cliquez pour parcourir</span
        ></span
      >
      <span v-if="!fileName" class="drop-touch">Choisir le fichier <code>.json</code> reçu</span>
      <input type="file" accept=".json,application/json" class="visually-hidden" @change="onPick" />
    </label>

    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="pack" class="summary">
      <p>
        Paquet de <strong>{{ pack.author }}</strong
        >, exporté le {{ formatDate(pack.exportedAt) }}.
      </p>
      <ul>
        <li>{{ pack.cards.length }} carte{{ pack.cards.length > 1 ? 's' : '' }}</li>
        <li v-if="newCategories.length">
          Nouvelles collections : {{ newCategories.map((c) => c.name).join(', ') }}
        </li>
        <li v-if="duplicates">
          {{ duplicates }} déjà présente{{ duplicates > 1 ? 's' : '' }} dans votre galerie
        </li>
      </ul>
      <p class="muted">
        Les nouvelles cartes arrivent en brouillon : publiez-les pour les mettre en jeu.
      </p>

      <fieldset v-if="duplicates" class="strategy">
        <legend class="label">Cartes déjà présentes</legend>
        <label><input v-model="strategy" type="radio" value="skip" /> Les ignorer</label>
        <label
          ><input v-model="strategy" type="radio" value="replace" /> Les remplacer par la version
          importée</label
        >
        <label><input v-model="strategy" type="radio" value="copy" /> Les importer en double</label>
      </fieldset>
    </div>

    <template #footer>
      <button class="btn" type="button" @click="emit('close')">Annuler</button>
      <button
        class="btn btn-primary"
        type="button"
        :disabled="!pack || busy"
        @click="confirmImport"
      >
        {{ busy ? 'Import…' : 'Importer' }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4);
  border: 1px dashed var(--line-strong);
  border-radius: var(--radius);
  background: var(--paper);
  text-align: center;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s;
}

.drop:hover,
.drop.dragging {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.drop.loaded {
  border-style: solid;
}

.drop svg {
  width: 28px;
  height: 28px;
  color: var(--accent);
}

.file {
  font-weight: 500;
}

.drop-touch {
  display: none;
}

@media (pointer: coarse) {
  .drop-desktop {
    display: none;
  }
  .drop-touch {
    display: inline;
  }
}

code {
  font-size: 12px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--paper-3);
}

.error {
  margin-top: var(--space-3);
  color: var(--danger);
}

.summary {
  margin-top: var(--space-4);
}

.summary ul {
  margin: var(--space-2) 0 0;
  padding-left: var(--space-5);
  color: var(--ink-2);
}

.strategy {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: var(--space-4) 0 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.strategy label {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
</style>
