<script setup lang="ts">
import { computed, watch, type Component } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import {
  ArrowLeftRight,
  BookOpen,
  Gift,
  LayoutGrid,
  Library,
  LogOut,
  Settings,
  Shield,
  SquarePlus,
  Users,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { useTradesStore } from '@/stores/trades'
import ToastStack from '@/components/ui/ToastStack.vue'

const auth = useAuthStore()
const trades = useTradesStore()
const route = useRoute()

interface NavLink {
  to: string
  label: string
  icon: Component
  exact?: boolean
  badge?: number
}

/** Sur mobile, l'éditeur occupe tout l'écran : il a sa propre barre. */
const inEditor = computed(() => route.name === 'editor')
const isPublic = computed(() => !!route.meta.public)
/** L'administrateur passe d'un espace à l'autre ; les joueurs n'ont que l'espace de jeu. */
const adminSpace = computed(() => !!route.meta.admin)

const links = computed<NavLink[]>(() =>
  adminSpace.value
    ? [
        { to: '/admin', label: 'Galerie', icon: LayoutGrid, exact: true },
        { to: '/admin/editor', label: 'Créer', icon: SquarePlus },
        { to: '/admin/collections', label: 'Collections', icon: Library },
        { to: '/admin/joueurs', label: 'Joueurs', icon: Users },
        { to: '/admin/reglages', label: 'Réglages', icon: Settings },
      ]
    : [
        { to: '/', label: 'Catalogue', icon: BookOpen, exact: true },
        { to: '/boosters', label: 'Boosters', icon: Gift },
        { to: '/echanges', label: 'Échanges', icon: ArrowLeftRight, badge: trades.incoming.length },
      ],
)

// Pastille des échanges reçus : rafraîchie à chaque navigation.
watch(
  () => route.fullPath,
  () => {
    if (auth.user && !isPublic.value) trades.load().catch(() => {})
  },
  { immediate: true },
)
</script>

<template>
  <div class="app" :class="{ 'in-editor': inEditor, public: isPublic }">
    <header v-if="!isPublic" class="topbar">
      <RouterLink :to="adminSpace ? '/admin' : '/'" class="logo">
        <span class="logo-mark" aria-hidden="true" />
        <span class="logo-text">AxoMaster</span>
        <span v-if="adminSpace" class="logo-badge">Admin</span>
      </RouterLink>

      <nav class="nav">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="nav-link"
          :active-class="link.exact ? '' : 'active'"
          :exact-active-class="'active'"
        >
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
        <span class="user-name" :title="auth.user?.username">{{ auth.user?.displayName }}</span>
        <button
          class="btn btn-ghost btn-icon btn-sm"
          type="button"
          title="Se déconnecter"
          aria-label="Se déconnecter"
          @click="auth.logout()"
        >
          <LogOut />
        </button>
      </div>
    </header>

    <main class="main">
      <RouterView />
    </main>

    <nav
      v-if="!isPublic"
      class="tabbar"
      aria-label="Navigation principale"
      :style="{ gridTemplateColumns: `repeat(${links.length}, 1fr)` }"
    >
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="tab"
        :active-class="link.exact ? '' : 'active'"
        :exact-active-class="'active'"
      >
        <span class="tab-icon">
          <component :is="link.icon" />
          <span v-if="link.badge" class="badge">{{ link.badge }}</span>
        </span>
        {{ link.label }}
      </RouterLink>
    </nav>

    <ToastStack />
  </div>
</template>

<style scoped>
.topbar {
  position: sticky;
  top: 0;
  z-index: 50;
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  height: var(--header-h);
  padding: 0 var(--space-6);
  padding-top: env(safe-area-inset-top);
  box-sizing: content-box;
  background: rgb(246 242 234 / 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.logo {
  display: inline-flex;
  align-items: center;
  gap: var(--space-3);
  justify-self: start;
  text-decoration: none;
}

.logo-mark {
  width: 18px;
  height: 24px;
  border: 1.5px solid var(--accent);
  border-radius: 3px;
  position: relative;
}

.logo-mark::after {
  content: '';
  position: absolute;
  inset: 0;
  margin: auto;
  width: 7px;
  height: 7px;
  background: var(--accent);
  transform: rotate(45deg);
}

.logo-text {
  font: 600 24px var(--font-serif);
  letter-spacing: 0.04em;
}

.nav {
  display: flex;
  gap: var(--space-1);
}

.nav-link {
  position: relative;
  padding: var(--space-2) var(--space-4);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.04em;
  color: var(--ink-2);
  text-decoration: none;
}

.nav-link:hover {
  color: var(--ink);
}

.nav-link.active {
  color: var(--ink);
}

.nav-link.active::after {
  content: '';
  position: absolute;
  left: var(--space-4);
  right: var(--space-4);
  bottom: -2px;
  height: 1px;
  background: var(--accent);
}

.logo-badge {
  padding: 2px 6px;
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
}

.badge {
  display: inline-grid;
  place-items: center;
  min-width: 17px;
  height: 17px;
  margin-left: 4px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--accent);
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

.user-name {
  overflow: hidden;
  max-width: 180px;
  font: italic 500 18px var(--font-serif);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.space-switch {
  text-decoration: none;
}

.main {
  min-height: calc(100dvh - var(--header-h));
}

.public .main {
  min-height: 100dvh;
}

.tabbar {
  display: none;
}

@media (max-width: 860px) {
  .topbar {
    grid-template-columns: auto 1fr;
    gap: var(--space-4);
    padding-inline: var(--space-4);
  }

  .logo-text {
    font-size: 22px;
  }

  .nav {
    display: none;
  }

  .account {
    gap: var(--space-1);
  }

  .user-name {
    max-width: 30vw;
    font-size: 17px;
  }

  .space-switch .text {
    display: none;
  }

  .main {
    min-height: calc(100dvh - var(--header-h) - var(--tabbar-h));
    padding-bottom: var(--tabbar-h);
  }

  .public .main {
    min-height: 100dvh;
    padding-bottom: 0;
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
    background: rgb(251 249 244 / 0.96);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--line);
  }

  .tab {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--ink-3);
    text-decoration: none;
  }

  .tab svg {
    width: 22px;
    height: 22px;
    stroke-width: 1.6;
  }

  .tab.active {
    color: var(--ink);
  }

  .tab.active svg {
    color: var(--accent);
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

  /* Éditeur plein écran : ni en-tête ni barre d'onglets. */
  .in-editor .topbar,
  .in-editor .tabbar {
    display: none;
  }

  .in-editor .main {
    min-height: 0;
    padding-bottom: 0;
  }
}
</style>
