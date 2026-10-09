<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, CircleQuestionMark, RotateCcw, Sparkles, X } from 'lucide-vue-next'
import { RARITY_INFO, RARITY_LIST, RARITY_WEIGHTS, type Card } from '@axomaster/card-model'
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

const cardCount = computed(() => collection.boosters?.cardCount ?? 0)
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
  return `${pad(h)}:${pad(m)}:${pad(sec)}`
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

/** Bulle d'aide « ? » : taux d'apparition des raretés. */
const helpOpen = ref(false)
function closeHelp() {
  helpOpen.value = false
}
window.addEventListener('click', closeHelp)

// ---------- Machine à états de l'ouverture ----------

type Phase = 'choose' | 'sealed' | 'opening' | 'reveal' | 'summary'

const phase = ref<Phase>('choose')
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
async function open() {
  if (busy.value) return
  if (!available.value) {
    toast.show(
      countdown.value ? `Prochain booster dans ${countdown.value}` : 'Aucun booster disponible',
    )
    return
  }
  busy.value = true
  try {
    const result = await collection.openBooster()
    clearTimers()
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

function close() {
  clearTimers()
  phase.value = 'choose'
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
      color: card.rarity === 'legendary' ? '#ede9fe' : RARITY_INFO[card.rarity].color,
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
  if (helpOpen.value && e.key === 'Escape') closeHelp()
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
  window.removeEventListener('click', closeHelp)
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
    <p v-if="loading" class="loading">Chargement…</p>

    <section v-else-if="cardCount" class="hero" :class="{ ready: available > 0 }">
      <div class="pack-zone">
        <div class="glow" aria-hidden="true">
          <span class="rays" />
          <span class="halo" />
        </div>
        <button
          type="button"
          class="hero-pack"
          :disabled="busy || !available"
          :aria-label="available ? 'Ouvrir le booster' : 'Aucun booster disponible'"
          @click="open"
        >
          <BoosterPack title="AxoMaster" :caption="`${size} cartes`" />
          <span v-if="available > 1" class="pack-count">×{{ available }}</span>
        </button>
        <p v-if="!available && countdown" class="pack-timer">
          <strong>{{ countdown }}</strong>
          <span>avant le prochain booster</span>
        </p>
      </div>

      <div class="cta">
        <button class="open-btn" type="button" :disabled="busy || !available" @click="open">
          <Sparkles /> {{ available ? 'Ouvrir le booster' : 'Bientôt disponible' }}
        </button>
        <p v-if="available" class="stock-line">
          {{ plural(available, 'booster') }} à ouvrir
          <template v-if="stock?.bonus">
            · dont {{ stock.bonus }} offert{{ stock.bonus > 1 ? 's' : '' }}
          </template>
        </p>
        <p v-if="available && countdown" class="next">
          +1 dans <strong>{{ countdown }}</strong>
        </p>
        <p v-else-if="available" class="next">
          Réserve pleine : ouvrez-en un pour relancer le compteur
        </p>
      </div>

      <div class="help" @click.stop>
        <button
          class="help-btn"
          type="button"
          :aria-expanded="helpOpen"
          aria-label="Contenu d’un booster et taux d’apparition"
          title="Taux d’apparition"
          @click="helpOpen = !helpOpen"
        >
          <CircleQuestionMark />
        </button>
        <Transition name="pop">
          <div v-if="helpOpen" class="help-pop" role="dialog" aria-label="Taux d’apparition">
            <p class="help-title">Dans chaque booster</p>
            <p class="help-text">
              {{ size }} cartes tirées parmi les {{ cardCount }} en jeu, dont au moins une rare ou
              mieux, révélée en dernier.
            </p>
            <ul>
              <li v-for="o in odds" :key="o.rarity" :style="{ '--rarity': o.info.color }">
                <span class="odds-pips">
                  <i v-for="n in 5" :key="n" :class="{ on: n <= o.info.rank }" />
                </span>
                <span>{{ o.info.label }}</span>
                <span class="odds-value">{{ o.percent }} %</span>
              </li>
            </ul>
            <p class="help-note">Taux par emplacement, parmi les raretés présentes en jeu.</p>
          </div>
        </Transition>
      </div>
    </section>

    <section v-else class="empty">
      <h2>Aucune carte en jeu</h2>
      <p>Les boosters seront disponibles dès que des cartes auront été publiées.</p>
      <div class="row">
        <RouterLink v-if="auth.isAdmin" class="btn btn-primary" to="/admin">
          Publier des cartes
        </RouterLink>
        <RouterLink class="btn on-dark" to="/"><BookOpen /> Catalogue</RouterLink>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="stage">
        <div v-if="overlay" class="stage" :class="`phase-${phase}`" role="dialog" aria-modal="true">
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
              <BoosterPack title="AxoMaster" :caption="`${size} cartes`" tearable @torn="onTorn" />
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
                @click="open"
              >
                <RotateCcw /> Ouvrir un autre ({{ available }})
              </button>
              <button class="btn on-dark" type="button" @click="close">Retour</button>
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
/* Page toujours « de nuit », dans les deux thèmes, comme la scène d'ouverture. */
.boosters {
  position: relative;
  display: grid;
  min-height: calc(100dvh - var(--header-h) - var(--tabbar-h));
  overflow: hidden;
  background:
    radial-gradient(55% 45% at 50% 40%, rgb(76 29 149 / 0.55), transparent 70%),
    radial-gradient(40% 30% at 85% 100%, rgb(14 165 233 / 0.12), transparent 70%), #0f172a;
  color: #e2e8f0;
}

.loading {
  place-self: center;
  color: #94a3b8;
}

.hero {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-6);
  padding: var(--space-6) var(--space-4) var(--space-7);
}

/* ---------- Paquet lumineux ---------- */

.pack-zone {
  position: relative;
  display: grid;
  place-items: center;
  isolation: isolate;
}

.glow {
  position: absolute;
  z-index: -1;
  inset: -45% -110%;
  display: grid;
  place-items: center;
  pointer-events: none;
  opacity: 0.3;
  transition: opacity 0.6s;
}

.ready .glow {
  opacity: 1;
}

.glow > span {
  grid-area: 1 / 1;
  aspect-ratio: 1;
  border-radius: 50%;
}

.rays {
  width: min(100%, 900px);
  background: repeating-conic-gradient(
    from 0deg,
    rgb(196 181 253 / 0.16) 0deg 3deg,
    transparent 3deg 15deg
  );
  mask: radial-gradient(closest-side, #000 20%, transparent 95%);
  animation: spin 50s linear infinite;
}

.halo {
  width: min(70%, 640px);
  background: radial-gradient(
    closest-side,
    rgb(167 139 250 / 0.55),
    rgb(124 58 237 / 0.25) 45%,
    transparent 100%
  );
  animation: pulse 3.2s ease-in-out infinite;
}

@keyframes spin {
  to {
    rotate: 360deg;
  }
}

@keyframes pulse {
  50% {
    scale: 1.12;
    opacity: 0.7;
  }
}

.hero-pack {
  position: relative;
  width: min(300px, 58vw, 36dvh);
  padding: 0;
  border: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  animation: hover-float 4.5s ease-in-out infinite;
}

.hero-pack :deep(.pack) {
  filter: drop-shadow(0 0 28px rgb(139 92 246 / 0.55));
  transition:
    transform 0.35s cubic-bezier(0.2, 0.8, 0.2, 1),
    filter 0.5s;
}

.hero-pack:hover :deep(.pack),
.hero-pack:focus-visible :deep(.pack) {
  transform: translateY(-6px) rotate(-1.5deg) scale(1.02);
}

.hero-pack:active :deep(.pack) {
  transform: scale(0.98);
}

.hero-pack:focus-visible {
  outline: none;
}

.hero-pack:disabled {
  cursor: default;
}

.hero:not(.ready) .hero-pack {
  animation: none;
}

.hero:not(.ready) .hero-pack :deep(.pack) {
  filter: grayscale(0.75) brightness(0.5);
  transform: none;
}

/* Paquet verrouillé : son texte s'efface derrière le compte à rebours. */
.hero:not(.ready) .hero-pack :deep(.content) {
  opacity: 0;
}

@keyframes hover-float {
  50% {
    translate: 0 -10px;
  }
}

.pack-count {
  position: absolute;
  top: 6%;
  right: -6%;
  display: grid;
  place-items: center;
  min-width: 44px;
  height: 44px;
  padding: 0 10px;
  border-radius: 22px;
  background: linear-gradient(135deg, #a78bfa, #6d28d9);
  box-shadow:
    0 0 0 3px #0f172a,
    0 6px 20px rgb(109 40 217 / 0.6);
  font: 700 17px var(--font-display);
  color: #fff;
}

/* Compte à rebours au milieu du paquet assombri. */
.pack-timer {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  pointer-events: none;
  text-align: center;
  text-shadow: 0 2px 12px rgb(0 0 0 / 0.6);
}

.pack-timer strong {
  font: 700 clamp(30px, 6vw, 44px) / 1 var(--font-display);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.pack-timer span {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #c4b5fd;
}

/* ---------- Appel à l'action ---------- */

.cta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  text-align: center;
}

.open-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  height: 56px;
  margin-bottom: var(--space-1);
  padding: 0 32px;
  overflow: hidden;
  border: 0;
  border-radius: 28px;
  background: linear-gradient(135deg, #a78bfa, #7c3aed 55%, #6d28d9);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.15) inset,
    0 10px 30px rgb(124 58 237 / 0.55);
  font: 700 17px var(--font-display);
  letter-spacing: -0.01em;
  color: #fff;
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.open-btn svg {
  width: 20px;
  height: 20px;
}

/* Reflet qui balaie le bouton. */
.open-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 35%,
    rgb(255 255 255 / 0.45) 50%,
    transparent 65%
  );
  translate: -100% 0;
  animation: sweep 3.2s ease-in-out infinite;
}

.open-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow:
    0 0 0 1px rgb(255 255 255 / 0.2) inset,
    0 14px 40px rgb(124 58 237 / 0.7);
}

.open-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.open-btn:disabled {
  background: rgb(255 255 255 / 0.08);
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.12) inset;
  color: #94a3b8;
  cursor: default;
}

.open-btn:disabled::after {
  display: none;
}

@keyframes sweep {
  60%,
  100% {
    translate: 100% 0;
  }
}

.stock-line {
  font-size: 14px;
  color: #cbd5e1;
}

.next {
  font-size: 13px;
  color: #94a3b8;
}

.next strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #c4b5fd;
}

/* ---------- Aide « ? » ---------- */

.help {
  position: absolute;
  right: var(--space-4);
  bottom: var(--space-4);
}

.help-btn {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.06);
  color: #cbd5e1;
  cursor: pointer;
}

.help-btn:hover,
.help-btn[aria-expanded='true'] {
  background: rgb(255 255 255 / 0.12);
  color: #fff;
}

.help-btn svg {
  width: 20px;
  height: 20px;
}

.help-pop {
  position: absolute;
  right: 0;
  bottom: calc(100% + var(--space-2));
  width: min(300px, calc(100vw - 2 * var(--space-4)));
  padding: var(--space-4);
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: var(--radius-lg);
  background: #1e1b4b;
  box-shadow: 0 20px 50px rgb(0 0 0 / 0.5);
  transform-origin: bottom right;
}

.help-title {
  font-weight: 600;
  color: #fff;
}

.help-text,
.help-note {
  margin-top: var(--space-1);
  font-size: 12.5px;
  color: #94a3b8;
}

.help-pop ul {
  display: grid;
  gap: 6px;
  margin: var(--space-3) 0;
  padding: 0;
  list-style: none;
}

.help-pop li {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-3);
  font-size: 13px;
}

.odds-pips {
  display: flex;
  gap: 4px;
}

.odds-pips i {
  width: 7px;
  height: 7px;
  transform: rotate(45deg);
  border: 1px solid color-mix(in srgb, var(--rarity) 60%, #fff);
}

.odds-pips i.on {
  background: color-mix(in srgb, var(--rarity) 60%, #fff);
}

.odds-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: #fff;
}

.pop-enter-active,
.pop-leave-active {
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* ---------- Aucune carte en jeu ---------- */

.empty {
  place-self: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-4);
  text-align: center;
  color: #94a3b8;
}

.empty h2 {
  font-size: 28px;
  color: #fff;
}

.empty .row {
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--space-3);
}

.new-pill {
  position: absolute;
  top: -10px;
  left: 50%;
  translate: -50% 0;
  padding: 3px 10px;
  border-radius: 10px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.3);
}

/* ---------- Scène d'ouverture ---------- */

.stage {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: radial-gradient(70% 55% at 50% 45%, rgb(76 29 149 / 0.75), transparent 70%), #0f172a;
  color: #e2e8f0;
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
  color: #e2e8f0;
}

.close:hover {
  background: rgb(255 255 255 / 0.08);
}

.stage .btn-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.stage .btn-primary:hover {
  background: #7c3aed;
  border-color: #7c3aed;
}

.on-dark {
  background: transparent;
  border-color: rgb(255 255 255 / 0.22);
  color: #e2e8f0;
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
  font: 400 15px var(--font-display);
  color: #94a3b8;
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
  color: #64748b;
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
  .hero {
    gap: var(--space-5);
    padding-bottom: calc(var(--space-7) + var(--space-4));
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
  .hint,
  .rays,
  .halo,
  .hero-pack,
  .open-btn::after {
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
