<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type Component } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import {
  ArrowLeftRight,
  Bell,
  BellOff,
  BookOpen,
  Gift,
  LayoutGrid,
  Library,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PenLine,
  Settings,
  Shield,
  SquarePlus,
  Sun,
  Trophy,
  Users,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useCardsStore } from '@/stores/cards'
import { useCollectionStore } from '@/stores/collection'
import { useTradesStore } from '@/stores/trades'
import { useTheme } from '@/composables/useTheme'
import { usePush } from '@/composables/usePush'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'
import ToastStack from '@/components/ui/ToastStack.vue'
import AxoX from '@/components/brand/AxoX.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'
import PlayerAvatar from '@/components/players/PlayerAvatar.vue'

const auth = useAuthStore()
const trades = useTradesStore()
const collection = useCollectionStore()
const cards = useCardsStore()
const route = useRoute()
const theme = useTheme()
const push = usePush()
const toast = useToast()

const THEME_INFO = {
  auto: { icon: Monitor, label: 'Thème : celui de l’appareil' },
  light: { icon: Sun, label: 'Thème : clair' },
  dark: { icon: Moon, label: 'Thème : sombre' },
}
const themeInfo = computed(() => THEME_INFO[theme.preference.value])
const THEME_CHOICES = [
  { value: 'auto', label: 'Appareil' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
] as const

interface NavLink {
  to: string
  label: string
  icon: Component
  exact?: boolean
  badge?: number
  /** Onglet mis en avant dans la barre mobile (bouton rond surélevé). */
  featured?: boolean
  /** Sur mobile, rangé dans le menu plutôt que dans la barre d'onglets. */
  inMenu?: boolean
}

/** Sur mobile, l'éditeur occupe tout l'écran : il a sa propre barre. */
const inEditor = computed(() => !!route.meta.editor)
const isPublic = computed(() => !!route.meta.public)
/** L'administrateur passe d'un espace à l'autre ; les joueurs n'ont que l'espace de jeu. */
const adminSpace = computed(() => !!route.meta.admin)
const watermark = computed(() => !!route.meta.watermark)

const links = computed<NavLink[]>(() =>
  adminSpace.value
    ? [
        // Pastille : propositions de joueurs en attente de validation.
        {
          to: '/admin',
          label: 'Galerie',
          icon: LayoutGrid,
          exact: true,
          badge: cards.pendingProposals,
        },
        { to: '/admin/editor', label: 'Créer', icon: SquarePlus },
        { to: '/admin/collections', label: 'Collections', icon: Library },
        { to: '/admin/joueurs', label: 'Joueurs', icon: Users },
        { to: '/admin/reglages', label: 'Réglages', icon: Settings, inMenu: true },
      ]
    : [
        { to: '/', label: 'Catalogue', icon: BookOpen, exact: true },
        { to: '/echanges', label: 'Échanges', icon: ArrowLeftRight, badge: trades.incoming.length },
        // Au milieu de la barre mobile (5 onglets avec « Menu »).
        {
          to: '/boosters',
          label: 'Boosters',
          icon: Gift,
          badge: collection.boosters?.stock.total,
          featured: true,
        },
        { to: '/classement', label: 'Classement', icon: Trophy },
        { to: '/creations', label: 'Mes créations', icon: PenLine, inMenu: true },
      ],
)

/** Barre d'onglets mobile : quatre liens au plus, puis l'onglet « Menu ». */
const tabs = computed(() => links.value.filter((l) => !l.inMenu))
const menuLinks = computed(() => links.value.filter((l) => l.inMenu))
const tabColumns = computed(() =>
  [...tabs.value.map((l) => (l.featured ? '1.3fr' : '1fr')), '1fr'].join(' '),
)

/**
 * Menu mobile (feuille basse) : remplace l'en-tête, masqué sur mobile pour laisser tout l'écran
 * au contenu (compte, thème, notifications, changement d'espace, déconnexion).
 */
const menuOpen = ref(false)
const menuActive = computed(() => menuLinks.value.some((l) => route.path.startsWith(l.to)))
watch(
  () => route.fullPath,
  () => (menuOpen.value = false),
)

// Pastilles (échanges reçus, boosters à ouvrir) : rafraîchies à chaque navigation.
function refreshBadges() {
  if (!auth.user || isPublic.value) return
  trades.load().catch(() => {})
  if (!adminSpace.value) collection.loadBoosters().catch(() => {})
}
watch(() => route.fullPath, refreshBadges, { immediate: true })

// Notifications : l'abonnement de l'appareil suit le compte connecté.
watch(
  () => auth.user?.id,
  (id) => {
    if (id) push.refresh()
  },
  { immediate: true },
)

// Une notification reçue pendant que l'app est ouverte : les pastilles sont à jour aussitôt.
function onWorkerMessage(event: MessageEvent) {
  if (event.data?.type === 'push') refreshBadges()
}
onMounted(() => navigator.serviceWorker?.addEventListener('message', onWorkerMessage))
onBeforeUnmount(() => navigator.serviceWorker?.removeEventListener('message', onWorkerMessage))

const bellLabel = computed(() =>
  push.subscribed.value
    ? 'Notifications activées sur cet appareil'
    : 'Notifications désactivées sur cet appareil',
)

async function toggleNotifications() {
  if (push.subscribed.value) {
    await push.disable()
    toast.show('Notifications désactivées sur cet appareil')
    return
  }
  try {
    const result = await push.enable()
    if (result === 'ok') toast.show('Notifications activées sur cet appareil')
    else if (result === 'install')
      toast.show(
        'Sur iPhone, ajoutez d’abord AxoMaster à l’écran d’accueil (Partager → Sur l’écran d’accueil), puis activez les notifications depuis l’app.',
        'info',
        8000,
      )
    else if (result === 'denied')
      toast.error(
        'Les notifications sont bloquées pour ce site : autorisez-les dans les réglages du navigateur.',
      )
    else toast.error('Les notifications ne sont pas disponibles sur cet appareil.')
  } catch (err) {
    toast.error(errorMessage(err))
  }
}
</script>

<template>
  <div class="app" :class="{ 'in-editor': inEditor, public: isPublic }">
    <header v-if="!isPublic" class="topbar" :class="{ 'admin-space': adminSpace }">
      <RouterLink :to="adminSpace ? '/admin' : '/'" class="logo">
        <span class="logo-mark"><AxoX gradient="violet" /></span>
        <span class="logo-text">AxoMaster</span>
        <span v-if="adminSpace" class="logo-badge">Admin</span>
      </RouterLink>

      <nav class="nav" aria-label="Navigation principale">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :active-class="link.exact ? '' : 'active'"
          :exact-active-class="'active'"
        >
          <component :is="link.icon" aria-hidden="true" />
          {{ link.label }}
          <span v-if="link.badge" class="badge">{{ link.badge }}</span>
        </RouterLink>
      </nav>

      <div class="account">
        <RouterLink
          v-if="auth.isAdmin"
          :to="adminSpace ? '/' : '/admin'"
          class="btn btn-ghost btn-sm space-switch"
          :title="adminSpace ? 'Revenir à l’espace de jeu' : 'Ouvrir l’administration'"
        >
          <Shield v-if="!adminSpace" /><BookOpen v-else />
          <span class="text">{{ adminSpace ? 'Jouer' : 'Administration' }}</span>
        </RouterLink>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          type="button"
          :title="themeInfo.label"
          :aria-label="`${themeInfo.label}. Changer de thème`"
          @click="theme.cycle()"
        >
          <component :is="themeInfo.icon" />
        </button>
        <button
          v-if="push.available.value"
          class="btn btn-ghost btn-icon btn-sm"
          type="button"
          :title="bellLabel"
          :aria-label="`${bellLabel}. ${push.subscribed.value ? 'Désactiver' : 'Activer'}`"
          :aria-pressed="push.subscribed.value"
          :disabled="push.busy.value"
          @click="toggleNotifications"
        >
          <Bell v-if="push.subscribed.value" /><BellOff v-else />
        </button>
        <span class="user-name" :title="auth.user?.username">{{ auth.user?.displayName }}</span>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          type="button"
          :title="`Se déconnecter (${auth.user?.displayName ?? ''})`"
          aria-label="Se déconnecter"
          @click="auth.logout()"
        >
          <LogOut />
        </button>
      </div>
    </header>

    <div v-if="watermark" class="watermark" aria-hidden="true"><AxoX /></div>

    <main class="main">
      <RouterView />
    </main>

    <nav
      v-if="!isPublic"
      class="tabbar"
      aria-label="Navigation principale"
      :style="{ gridTemplateColumns: tabColumns }"
    >
      <RouterLink
        v-for="link in tabs"
        :key="link.to"
        :to="link.to"
        class="tab"
        :class="{ featured: link.featured }"
        :active-class="link.exact ? '' : 'active'"
        :exact-active-class="'active'"
      >
        <span class="tab-icon">
          <component :is="link.icon" />
          <span v-if="link.badge" class="badge">{{ link.badge }}</span>
        </span>
        {{ link.label }}
      </RouterLink>
      <button
        type="button"
        class="tab"
        :class="{ active: menuActive || menuOpen }"
        aria-haspopup="dialog"
        :aria-expanded="menuOpen"
        @click="menuOpen = true"
      >
        <span class="tab-icon"><Menu /></span>
        Menu
      </button>
    </nav>

    <BaseDialog v-if="!isPublic" :open="menuOpen" title="Menu" @close="menuOpen = false">
      <div class="menu">
        <div class="menu-user">
          <PlayerAvatar
            v-if="auth.user"
            :id="auth.user.id"
            :name="auth.user.displayName"
            :size="44"
          />
          <div class="menu-user-text">
            <strong>{{ auth.user?.displayName }}</strong>
            <span class="muted">@{{ auth.user?.username }}</span>
          </div>
        </div>

        <RouterLink v-for="link in menuLinks" :key="link.to" :to="link.to" class="menu-item">
          <component :is="link.icon" /> {{ link.label }}
        </RouterLink>
        <RouterLink v-if="auth.isAdmin" :to="adminSpace ? '/' : '/admin'" class="menu-item">
          <Shield v-if="!adminSpace" /><BookOpen v-else />
          {{ adminSpace ? 'Revenir à l’espace de jeu' : 'Ouvrir l’administration' }}
        </RouterLink>
        <button
          v-if="push.available.value"
          type="button"
          class="menu-item"
          :aria-pressed="push.subscribed.value"
          :disabled="push.busy.value"
          @click="toggleNotifications"
        >
          <Bell v-if="push.subscribed.value" /><BellOff v-else />
          {{ push.subscribed.value ? 'Désactiver les notifications' : 'Activer les notifications' }}
        </button>

        <div class="field">
          <span class="label">Thème</span>
          <div class="segmented" role="group" aria-label="Thème">
            <button
              v-for="choice in THEME_CHOICES"
              :key="choice.value"
              type="button"
              :class="{ active: theme.preference.value === choice.value }"
              @click="theme.preference.value = choice.value"
            >
              {{ choice.label }}
            </button>
          </div>
        </div>

        <button type="button" class="menu-item danger" @click="auth.logout()">
          <LogOut /> Se déconnecter
        </button>
      </div>
    </BaseDialog>

    <ToastStack />
  </div>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: var(--space-5);
  align-items: center;
  height: var(--header-h);
  padding: 0 var(--space-6);
  padding-top: env(safe-area-inset-top);
  box-sizing: content-box;
  background: var(--shell);
  color: var(--shell-ink);
  border-bottom: 1px solid var(--shell-line);
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  justify-self: start;
  text-decoration: none;
}

.logo-mark {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 7px 8px;
  border-radius: 9px;
  background: var(--night);
  box-shadow: 0 2px 8px rgb(var(--brand-rgb) / 0.25);
}

[data-theme='dark'] .logo-mark {
  box-shadow:
    inset 0 0 0 1px rgb(var(--brand-light-rgb) / 0.35),
    0 2px 12px rgb(var(--brand-rgb) / 0.35);
}

.logo-text {
  font: 700 20px var(--font-display);
  letter-spacing: -0.02em;
}

.nav {
  display: flex;
  gap: var(--space-1);
  justify-self: center;
}

.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: var(--radius);
  font-size: 13px;
  font-weight: 500;
  color: var(--shell-muted);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--shell-ink);
  background: var(--shell-active);
}

.nav-link.active {
  color: var(--shell-ink);
  background: var(--shell-active);
}

.nav-link svg {
  width: 15px;
  height: 15px;
  flex: none;
}

.nav-link.active svg {
  color: var(--shell-accent);
}

.logo-badge {
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  background: var(--shell-active);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--shell-accent);
}

.badge {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent-strong);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
}

.account {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.account .btn-ghost {
  color: var(--shell-muted);
}

.account .btn-ghost:hover {
  background: var(--shell-active);
  color: var(--shell-ink);
}

.topbar :focus-visible {
  outline-color: var(--shell-accent);
}

.user-name {
  overflow: hidden;
  max-width: 110px;
  font: 500 14px var(--font-display);
  color: var(--shell-ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.space-switch {
  text-decoration: none;
}

.main {
  position: relative;
  z-index: 1;
  min-height: calc(100dvh - var(--header-h));
}

/* Grand X en filigrane, fixe derrière le contenu (comme sur la page de connexion). */
.watermark {
  position: fixed;
  right: -8vmin;
  bottom: -14vmin;
  z-index: 0;
  width: 62vmin;
  color: rgb(var(--brand-rgb) / 0.05);
  transform: rotate(-8deg);
  pointer-events: none;
}

[data-theme='dark'] .watermark {
  color: rgb(var(--brand-light-rgb) / 0.05);
}

.public .main {
  min-height: 100dvh;
}

.tabbar {
  display: none;
}

@media (min-width: 861px) and (max-width: 1180px) {
  .topbar {
    gap: var(--space-3);
    padding-inline: var(--space-4);
  }

  .nav-link {
    padding-inline: 8px;
    gap: 5px;
  }

  .user-name,
  .space-switch .text {
    display: none;
  }
}

@media (max-width: 860px) {
  /* Plein écran : pas d'en-tête sur mobile, ses actions passent dans l'onglet « Menu ». */
  .topbar {
    display: none;
  }

  /* --header-h vaut ici la seule zone de la barre d'état (encoche). */
  .main {
    min-height: 100dvh;
    padding-top: var(--header-h);
    padding-bottom: var(--tabbar-h);
  }

  .public .main {
    padding: 0;
  }

  /* Remonté au-dessus de la barre d'onglets. */
  .watermark {
    right: -30vmin;
    bottom: calc(var(--tabbar-h) - 14vmin);
    width: 90vmin;
  }

  .tabbar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 50;
    display: grid;
    height: var(--tabbar-h);
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--shell);
    border-top: 1px solid var(--shell-line);
  }

  .tab {
    display: flex;
    padding: 0;
    border: 0;
    background: none;
    font-family: inherit;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--shell-muted);
    text-decoration: none;
  }

  .tab svg {
    width: 22px;
    height: 22px;
    stroke-width: 1.6;
  }

  .tab.active {
    color: var(--shell-accent);
  }

  .tab.active svg {
    color: var(--shell-accent);
  }

  .tab-icon {
    position: relative;
    display: grid;
  }

  .tab-icon .badge {
    position: absolute;
    top: -4px;
    right: -12px;
    margin: 0;
  }

  /* Onglet Boosters : bouton rond surélevé, pour inciter à ouvrir. */
  .tab.featured {
    font-weight: 600;
    color: var(--shell-accent);
  }

  .tab.featured .tab-icon {
    place-items: center;
    width: 54px;
    height: 54px;
    margin-top: -24px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--brand-light), var(--brand) 55%, var(--brand-deep));
    box-shadow:
      0 0 0 4px var(--shell),
      0 6px 18px rgb(var(--brand-rgb) / 0.45);
    transition:
      transform 0.2s,
      box-shadow 0.2s;
  }

  .tab.featured svg,
  .tab.featured.active svg {
    width: 26px;
    height: 26px;
    stroke-width: 2;
    color: #fff;
  }

  .tab.featured.active .tab-icon {
    box-shadow:
      0 0 0 4px var(--shell),
      0 0 0 6px rgb(var(--brand-light-rgb) / 0.5),
      0 8px 24px rgb(var(--brand-rgb) / 0.6);
  }

  .tab.featured:active .tab-icon {
    transform: scale(0.94);
  }

  .tab.featured .tab-icon .badge {
    top: -2px;
    right: -4px;
    background: #fff;
    color: var(--brand-deep);
    box-shadow: 0 1px 4px rgb(0 0 0 / 0.25);
  }

  /* Éditeur plein écran : pas de barre d'onglets. */
  .in-editor .tabbar {
    display: none;
  }

  .in-editor .main {
    min-height: 0;
    padding: 0;
  }
}

/* Menu mobile. */
.menu {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.menu-user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-3);
  margin-bottom: var(--space-1);
  border-bottom: 1px solid var(--line);
}

.menu-user-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.menu-user-text strong {
  font: 600 17px var(--font-display);
}

.menu-user-text span {
  font-size: 13px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font: 500 15px var(--font-display);
  color: var(--ink);
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.menu-item svg {
  width: 20px;
  height: 20px;
  color: var(--ink-3);
}

.menu-item.router-link-active {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.menu-item.danger,
.menu-item.danger svg {
  color: var(--danger);
}

.menu .field {
  margin: var(--space-2) 0;
}

.menu .segmented {
  display: flex;
}

.menu .segmented button {
  flex: 1;
}
</style>
