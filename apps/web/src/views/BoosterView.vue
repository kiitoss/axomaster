<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Gift, RotateCcw, X } from 'lucide-vue-next'
import {
  RARITY_INFO,
  RARITY_LIST,
  RARITY_WEIGHTS,
  type BoosterOffer,
  type Card,
} from '@axomaster/card-model'
import { useCardsStore } from '@/stores/cards'
import { useCollectionStore } from '@/stores/collection'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import BoosterPack from '@/components/booster/BoosterPack.vue'
import RevealCard from '@/components/booster/RevealCard.vue'
import CardView from '@/components/card/CardView.vue'
import CardViewer from '@/components/gallery/CardViewer.vue'

const store = useCardsStore()
const collection = useCollectionStore()
const auth = useAuthStore()
const toast = useToast()

const loading = ref(true)

onMounted(async () => {
  try {
    await Promise.all([collection.loadBoosters(), store.ensureCategories()])
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loading.value = false
  }
})

const offers = computed(() => collection.boosters?.offers ?? [])
const stock = computed(() => collection.boosters?.stock ?? null)
const size = computed(() => collection.boosters?.size ?? 5)
const available = computed(() => stock.value?.total ?? 0)

// Compte à rebours jusqu'au prochain booster.
const now = ref(Date.now())
let refreshing = false
const ticker = setInterval(() => {
  now.value = Date.now()
  const next = stock.value?.nextAt
  // Recharge atteinte : on relit le stock auprès du serveur.
  if (next && new Date(next).getTime() <= now.value && !refreshing) {
    refreshing = true
    collection
      .loadBoosters()
      .catch(() => {})
      .finally(() => (refreshing = false))
  }
}, 1000)

const countdown = computed(() => {
  const next = stock.value?.nextAt
  if (!next) return ''
  const ms = Math.max(0, new Date(next).getTime() - now.value)
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  const sec = Math.floor((ms % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h} h ${pad(m)}` : `${pad(m)} min ${pad(sec)}`
})

const odds = computed(() => {
  const total = RARITY_LIST.reduce((sum, r) => sum + RARITY_WEIGHTS[r], 0)
  return RARITY_LIST.map((r) => ({
    rarity: r,
    info: RARITY_INFO[r],
    percent: Math.round((RARITY_WEIGHTS[r] / total) * 100),
  }))
})

function plural(n: number, word: string) {
  return `${n} ${word}${n > 1 ? 's' : ''}`
}

// ---------- Machine à états de l'ouverture ----------

type Phase = 'choose' | 'sealed' | 'opening' | 'reveal' | 'summary'

const phase = ref<Phase>('choose')
const booster = ref<BoosterOffer | null>(null)
const drawn = ref<Card[]>([])
const newIds = ref(new Set<string>())
const busy = ref(false)
const current = ref(0)
const revealed = ref<boolean[]>([])
const charging = ref(false)
const flash = ref<{ key: number; color: string } | null>(null)
const viewerIndex = ref<number | null>(null)
/** Change à chaque ouverture pour rejouer les animations d'entrée. */
const run = ref(0)

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const t = setTimeout(() => {
    timers.delete(t)
    fn()
  }, ms)
  timers.add(t)
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers.clear()
}

/** Le tirage a lieu côté serveur ; l'animation démarre une fois les cartes reçues. */
async function open(b: BoosterOffer) {
  if (busy.value) return
  if (!available.value) {
    toast.show(
      countdown.value ? `Prochain booster dans ${countdown.value}` : 'Aucun booster disponible',
    )
    return
  }
  busy.value = true
  try {
    const result = await collection.openBooster(b.pool)
    clearTimers()
    booster.value = b
    drawn.value = result.cards
    newIds.value = new Set(result.newCardIds)
    current.value = 0
    revealed.value = result.cards.map(() => false)
    charging.value = false
    flash.value = null
    viewerIndex.value = null
    run.value++
    phase.value = 'sealed'
  } catch (err) {
    toast.error(errorMessage(err))
    collection.loadBoosters().catch(() => {})
  } finally {
    busy.value = false
  }
}

function reopen() {
  if (booster.value) open(booster.value)
}

function close() {
  clearTimers()
  phase.value = 'choose'
  booster.value = null
  viewerIndex.value = null
}

function onTorn() {
  phase.value = 'opening'
  later(() => (phase.value = 'reveal'), 900)
}

const top = computed(() => drawn.value[current.value])

/** Premier tap : retourne la carte. Second tap : l'écarte et passe à la suivante. */
function advance() {
  if (phase.value !== 'reveal' || charging.value || !top.value) return
  const i = current.value
  if (!revealed.value[i]) {
    const card = top.value
    const rank = RARITY_INFO[card.rarity].rank
    if (rank >= RARITY_INFO.epic.rank && !reducedMotion) {
      charging.value = true
      later(() => {
        charging.value = false
        flip(i, card)
      }, 700)
    } else flip(i, card)
    return
  }
  current.value++
  if (current.value >= drawn.value.length) later(() => (phase.value = 'summary'), 450)
}

function flip(i: number, card: Card) {
  revealed.value[i] = true
  const rank = RARITY_INFO[card.rarity].rank
  if (rank >= RARITY_INFO.epic.rank && !reducedMotion) {
    flash.value = {
      key: Date.now(),
      color: card.rarity === 'legendary' ? '#fff3d0' : RARITY_INFO[card.rarity].color,
    }
  }
}

function revealAll() {
  clearTimers()
  charging.value = false
  phase.value = 'summary'
}

/** Une carte n'est « nouvelle » qu'à sa première occurrence dans le booster. */
function isNew(index: number) {
  const card = drawn.value[index]
  if (!card || !newIds.value.has(card.id)) return false
  return drawn.value.findIndex((c) => c.id === card.id) === index
}

/** Pile : la carte courante devant, les suivantes légèrement en retrait, les vues écartées. */
function slotStyle(i: number) {
  const d = i - current.value
  if (d < 0) {
    const side = i % 2 ? -1 : 1
    return {
      zIndex: 20 + i,
      transform: `translate(${side * 140}%, -8%) rotate(${side * 22}deg)`,
      opacity: 0,
    }
  }
  return {
    zIndex: 10 - d,
    transform: `translateY(${-d * 2.6}%) scale(${1 - d * 0.04})`,
    opacity: d > 3 ? 0 : 1,
  }
}

/** Récapitulatif en éventail : décalage par rapport à la carte centrale. */
function fanStyle(i: number) {
  const offset = i - (drawn.value.length - 1) / 2
  return { '--i': i, '--offset': offset, '--lift': Math.abs(offset) }
}

// ---------- Superposition plein écran ----------

const overlay = computed(() => phase.value !== 'choose')

watch([overlay, viewerIndex], ([on]) => {
  // CardViewer libère le défilement à sa fermeture : on le rebloque tant que la scène est ouverte.
  document.body.style.overflow = on ? 'hidden' : ''
})

function onKey(e: KeyboardEvent) {
  if (!overlay.value || viewerIndex.value !== null) return
  if (e.key === 'Escape') close()
  else if (phase.value === 'reveal' && [' ', 'Enter', 'ArrowRight'].includes(e.key)) {
    e.preventDefault()
    advance()
  }
}
window.addEventListener('keydown', onKey)

onBeforeUnmount(() => {
  clearTimers()
  clearInterval(ticker)
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})

const hint = computed(() => {
  if (phase.value === 'sealed') return 'Glissez sur le paquet pour le déchirer, ou touchez-le'
  if (phase.value !== 'reveal') return ''
  if (!revealed.value[current.value]) return 'Touchez pour retourner'
  return isNew(current.value)
    ? 'Nouvelle carte ! Touchez pour continuer'
    : 'Touchez pour la carte suivante'
})
</script>

<template>
  <div class="boosters">
    <section class="intro">
      <p class="eyebrow">Boosters</p>
      <h1>Ouvrir un booster</h1>
      <p class="muted">
        Chaque booster contient {{ size }} cartes tirées parmi les cartes en jeu, dont au moins une
        rare ou mieux. Les cartes obtenues rejoignent votre catalogue.
      </p>
    </section>

    <section v-if="stock" class="stock" :class="{ out: !available }">
      <Gift />
      <div>
        <p class="stock-count">
          {{ available ? plural(available, 'booster') + ' à ouvrir' : 'Aucun booster à ouvrir' }}
        </p>
        <p class="muted">
          <template v-if="stock.bonus">
            Dont {{ plural(stock.bonus, 'booster') }} offert{{ stock.bonus > 1 ? 's' : '' }}.
          </template>
          <template v-if="countdown">Prochain booster dans {{ countdown }}.</template>
          <template v-else>Réserve pleine : ouvrez-en un pour relancer le compteur.</template>
        </p>
      </div>
    </section>

    <p v-if="loading" class="muted">Chargement…</p>

    <template v-else-if="offers.length">
      <section class="shelf">
        <button
          v-for="b in offers"
          :key="b.pool"
          type="button"
          class="shelf-item"
          :class="{ locked: !available }"
          :disabled="busy"
          :aria-label="`Ouvrir le booster ${b.title}`"
          @click="open(b)"
        >
          <BoosterPack :title="b.title" :color="b.color" :caption="`${size} cartes`" />
          <span class="shelf-count">{{ plural(b.cardCount, 'carte') }} en jeu</span>
        </button>
      </section>

      <section class="odds">
        <h2>Taux d’apparition</h2>
        <ul>
          <li v-for="o in odds" :key="o.rarity" :style="{ '--rarity': o.info.color }">
            <span class="odds-pips"><i v-for="n in 5" :key="n" :class="{ on: n <= o.info.rank }" /></span>
            <span class="odds-label">{{ o.info.label }}</span>
            <span class="odds-value">{{ o.percent }} %</span>
          </li>
        </ul>
        <p class="muted">
          Par emplacement, parmi les raretés présentes dans le paquet. Le dernier emplacement est
          garanti rare ou mieux.
        </p>
      </section>
    </template>

    <section v-else class="empty">
      <h2>Aucune carte en jeu</h2>
      <p class="muted">Les boosters seront disponibles dès que des cartes auront été publiées.</p>
      <div class="row">
        <RouterLink v-if="auth.isAdmin" class="btn btn-primary" to="/admin">
          Publier des cartes
        </RouterLink>
        <RouterLink class="btn" to="/"><BookOpen /> Catalogue</RouterLink>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="stage">
        <div
          v-if="overlay && booster"
          class="stage"
          :class="`phase-${phase}`"
          role="dialog"
          aria-modal="true"
        >
          <button
            class="close btn btn-ghost btn-icon"
            type="button"
            aria-label="Fermer"
            @click="close"
          >
            <X />
          </button>

          <div v-if="phase !== 'summary'" class="scene">
            <div
              v-if="phase === 'sealed' || phase === 'opening'"
              :key="`pack-${run}`"
              class="pack-slot"
            >
              <BoosterPack
                :title="booster.title"
                :color="booster.color"
                :caption="`${size} cartes`"
                tearable
                @torn="onTorn"
              />
            </div>

            <div
              v-if="phase === 'opening' || phase === 'reveal'"
              :key="`stack-${run}`"
              class="stack"
              @click="advance"
            >
              <div v-for="(card, i) in drawn" :key="i" class="slot" :style="slotStyle(i)">
                <div class="rise" :style="{ animationDelay: `${(drawn.length - 1 - i) * 70}ms` }">
                  <RevealCard
                    :card="card"
                    :category="store.getCategory(card.categoryId)"
                    :flipped="!!revealed[i]"
                    :charging="charging && i === current"
                    :active="i === current"
                  />
                </div>
              </div>
            </div>
          </div>

          <div v-else :key="`summary-${run}`" class="summary">
            <p class="eyebrow">{{ booster.title }}</p>
            <h2>Votre booster</h2>
            <div class="summary-cards">
              <button
                v-for="(card, i) in drawn"
                :key="i"
                type="button"
                class="summary-card"
                :style="fanStyle(i)"
                :aria-label="`Voir ${card.name || 'la carte'}`"
                @click="viewerIndex = i"
              >
                <CardView :card="card" :category="store.getCategory(card.categoryId)" interactive />
                <span v-if="isNew(i)" class="new-pill">Nouvelle</span>
              </button>
            </div>
            <div class="summary-actions">
              <button
                v-if="available"
                class="btn btn-primary"
                type="button"
                :disabled="busy"
                @click="reopen"
              >
                <RotateCcw /> Ouvrir un autre ({{ available }})
              </button>
              <button class="btn on-dark" type="button" @click="close">Changer de paquet</button>
            </div>
          </div>

          <div v-if="flash" :key="flash.key" class="flash" :style="{ '--flash': flash.color }" />

          <footer v-if="phase !== 'summary'" class="stage-foot">
            <p class="hint">{{ hint }}</p>
            <p v-if="phase === 'reveal'" class="progress">
              {{ Math.min(current + 1, drawn.length) }} / {{ drawn.length }}
            </p>
            <button
              v-if="phase === 'reveal'"
              class="btn btn-sm on-dark"
              type="button"
              @click="revealAll"
            >
              Tout révéler
            </button>
          </footer>
        </div>
      </Transition>
    </Teleport>

    <CardViewer
      v-if="viewerIndex !== null && drawn.length"
      v-model:index="viewerIndex"
      :cards="drawn"
      readonly
      @close="viewerIndex = null"
    />
  </div>
</template>

<style scoped>
.boosters {
  max-width: 1320px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-6);
}

.intro {
  margin-bottom: var(--space-6);
}

.intro h1 {
  font-size: 52px;
  line-height: 1.05;
  font-weight: 500;
}

.intro .muted {
  margin-top: var(--space-2);
  max-width: 560px;
}

/* ---------- Présentoir ---------- */

.shelf {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: var(--space-6) var(--space-5);
  padding: var(--space-6) 0;
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
}

.shelf-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: var(--ink-3);
  cursor: pointer;
}

.shelf-item :deep(.pack) {
  width: min(100%, 220px);
  transition:
    transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 0.35s;
}

.shelf-item:hover :deep(.pack),
.shelf-item:focus-visible :deep(.pack) {
  transform: translateY(-8px) rotate(-1.5deg);
}

.shelf-item:active :deep(.pack) {
  transform: translateY(-2px) scale(0.98);
}

.shelf-item:disabled {
  cursor: progress;
}

.shelf-item.locked :deep(.pack) {
  filter: grayscale(0.7) brightness(0.92);
}

.shelf-count {
  font-size: 12px;
  letter-spacing: 0.04em;
}

.stock {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
  padding: var(--space-4) var(--space-5);
  border: 1px solid var(--accent);
  border-radius: var(--radius-lg);
  background: var(--accent-soft);
}

.stock.out {
  border-color: var(--line);
  background: var(--surface);
}

.stock > svg {
  flex: none;
  width: 28px;
  height: 28px;
  color: var(--accent);
}

.stock-count {
  font: 500 24px var(--font-serif);
}

.new-pill {
  position: absolute;
  top: -10px;
  left: 50%;
  translate: -50% 0;
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--accent);
  color: #1a1815;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.3);
}

.odds {
  max-width: 560px;
  margin-top: var(--space-6);
}

.odds h2 {
  font-size: 24px;
  font-weight: 500;
  margin-bottom: var(--space-3);
}

.odds ul {
  margin: 0 0 var(--space-3);
  padding: 0;
  list-style: none;
}

.odds li {
  display: grid;
  grid-template-columns: 70px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
}

.odds-pips {
  display: flex;
  gap: 5px;
}

.odds-pips i {
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  border: 1px solid var(--rarity);
}

.odds-pips i.on {
  background: var(--rarity);
}

.odds-value {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.odds .muted {
  font-size: 12px;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) 0;
  text-align: center;
  border-top: 1px solid var(--line);
}

.empty h2 {
  font-size: 30px;
  font-weight: 500;
}

.empty .row {
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--space-3);
}

/* ---------- Scène d'ouverture ---------- */

.stage {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(70% 55% at 50% 45%, rgb(60 54 44 / 0.9), transparent 70%), rgb(20 18 16);
  color: #ece6da;
  overflow: hidden;
}

.stage-enter-active,
.stage-leave-active {
  transition: opacity 0.3s ease;
}

.stage-enter-from,
.stage-leave-to {
  opacity: 0;
}

.close {
  position: absolute;
  top: calc(var(--space-4) + env(safe-area-inset-top));
  right: var(--space-4);
  z-index: 60;
  color: #ece6da;
}

.close:hover {
  background: rgb(255 255 255 / 0.08);
}

.stage .btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1815;
}

.stage .btn-primary:hover {
  background: #bb9440;
  border-color: #bb9440;
}

.on-dark {
  background: transparent;
  border-color: rgb(255 255 255 / 0.22);
  color: #ece6da;
}

.on-dark:hover {
  background: rgb(255 255 255 / 0.08);
  border-color: rgb(255 255 255 / 0.4);
}

.scene {
  position: relative;
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 0;
  padding-top: env(safe-area-inset-top);
}

.pack-slot,
.stack {
  grid-area: 1 / 1;
}

.pack-slot {
  width: min(70vw, 38dvh, 330px);
  animation: pack-in 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

@keyframes pack-in {
  from {
    opacity: 0;
    transform: translateY(12%) scale(0.92);
  }
}

.phase-opening .pack-slot {
  animation: pack-out 0.8s cubic-bezier(0.5, 0, 0.75, 0) forwards;
  pointer-events: none;
}

@keyframes pack-out {
  from {
    transform: none;
  }
  to {
    opacity: 0;
    transform: translateY(85%) scale(0.95);
  }
}

.stack {
  position: relative;
  width: min(76vw, 44dvh, 380px);
  aspect-ratio: 630 / 880;
  /* Place pour le libellé de rareté sous la carte. */
  margin-bottom: 72px;
  cursor: pointer;
  touch-action: manipulation;
  z-index: 1;
}

.slot {
  position: absolute;
  inset: 0;
  transition:
    transform 0.55s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.45s ease;
}

.rise {
  width: 100%;
  height: 100%;
}

.phase-opening .rise {
  animation: rise 0.75s cubic-bezier(0.2, 0.9, 0.3, 1.1) both;
}

@keyframes rise {
  from {
    opacity: 0;
    transform: translateY(70%) scale(0.88);
  }
  40% {
    opacity: 1;
  }
}

.flash {
  position: absolute;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  background: radial-gradient(circle at 50% 45%, var(--flash), transparent 75%);
  mix-blend-mode: screen;
  opacity: 0;
  animation: flash 1.1s 0.3s ease-out;
}

@keyframes flash {
  15% {
    opacity: 0.9;
  }
  to {
    opacity: 0;
  }
}

.stage-foot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  min-height: 112px;
  padding: var(--space-3) var(--space-4) calc(var(--space-5) + env(safe-area-inset-bottom));
  text-align: center;
}

.hint {
  font: italic 500 19px var(--font-serif);
  color: #b9b1a3;
  animation: breathe 2.6s ease-in-out infinite;
}

@keyframes breathe {
  50% {
    opacity: 0.55;
  }
}

.progress {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: #8f877a;
}

/* ---------- Récapitulatif ---------- */

.summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: var(--space-7) var(--space-5) calc(var(--space-6) + env(safe-area-inset-bottom));
  overflow-y: auto;
}

.summary h2 {
  font-size: 40px;
  font-weight: 500;
}

.summary-cards {
  display: flex;
  justify-content: center;
  margin: var(--space-6) 0 var(--space-7);
  padding: 0 var(--space-6);
}

/* Éventail : chaque carte pivote autour d'un point bas commun. */
.summary-card {
  position: relative;
  width: clamp(150px, 15vw, 220px);
  margin: 0 -14px;
  padding: 0;
  border: 0;
  background: none;
  cursor: zoom-in;
  border-radius: 12px;
  transform-origin: 50% 160%;
  transform: rotate(calc(var(--offset) * 5deg)) translateY(calc(var(--lift) * 8px));
  transition: transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  animation: deal 0.6s calc(var(--i) * 90ms) cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.summary-card:hover,
.summary-card:focus-visible {
  z-index: 1;
  transform: rotate(calc(var(--offset) * 5deg)) translateY(-24px) scale(1.04);
}

@keyframes deal {
  from {
    opacity: 0;
    translate: 0 40px;
  }
}

.summary-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
}

@media (max-width: 860px) {
  .boosters {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .intro {
    margin-bottom: var(--space-4);
  }

  .intro h1 {
    font-size: 40px;
  }

  .shelf {
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-5) var(--space-3);
    padding: var(--space-5) 0;
  }

  .close {
    top: calc(var(--space-3) + env(safe-area-inset-top));
    right: var(--space-3);
  }

  .hint {
    font-size: 17px;
  }

  .summary {
    justify-content: flex-start;
    padding-top: calc(var(--space-7) + env(safe-area-inset-top));
  }

  .summary h2 {
    font-size: 30px;
  }

  /* Plus d'éventail : une grille lisible au doigt. */
  .summary-cards {
    flex-wrap: wrap;
    width: 100%;
    max-width: 460px;
    gap: var(--space-4) var(--space-3);
    margin: var(--space-5) 0 var(--space-6);
    padding: 0;
  }

  .summary-card,
  .summary-card:hover,
  .summary-card:focus-visible {
    width: calc(50% - var(--space-2));
    max-width: 220px;
    margin: 0;
    transform: none;
  }

  .summary-actions {
    width: 100%;
    max-width: 420px;
  }

  .summary-actions .btn {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pack-slot,
  .phase-opening .rise,
  .summary-card,
  .hint {
    animation: none;
  }

  .phase-opening .pack-slot {
    animation: none;
    opacity: 0;
  }

  .slot {
    transition: opacity 0.3s;
  }
}
</style>
