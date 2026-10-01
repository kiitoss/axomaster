<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import { PenLine } from 'lucide-vue-next'
import { useCardsStore } from '@/stores/cards'
import ToastStack from '@/components/ui/ToastStack.vue'

const store = useCardsStore()
</script>

<template>
  <header class="topbar">
    <RouterLink to="/" class="logo">
      <span class="logo-mark" aria-hidden="true" />
      <span class="logo-text">AxoMaster</span>
    </RouterLink>

    <nav class="nav">
      <RouterLink to="/" class="nav-link" exact-active-class="active">Galerie</RouterLink>
      <RouterLink to="/editor" class="nav-link" active-class="active">Créer</RouterLink>
      <RouterLink to="/collections" class="nav-link" active-class="active">Collections</RouterLink>
    </nav>

    <label class="signature" title="Votre nom apparaît sur les cartes créées et les paquets exportés">
      <PenLine />
      <input v-model.trim="store.author" class="signature-input" placeholder="Votre nom" maxlength="80" />
    </label>
  </header>

  <main class="main">
    <RouterView />
  </main>

  <ToastStack />
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

.signature {
  justify-self: end;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--ink-3);
}

.signature svg {
  width: 14px;
  height: 14px;
}

.signature-input {
  width: 160px;
  border: 0;
  border-bottom: 1px solid transparent;
  background: transparent;
  font: italic 500 18px var(--font-serif);
  color: var(--ink);
  padding: 2px 0;
}

.signature-input:hover,
.signature-input:focus {
  outline: none;
  border-bottom-color: var(--line-strong);
}

.main {
  min-height: calc(100vh - var(--header-h));
}

@media (max-width: 720px) {
  .topbar {
    grid-template-columns: auto 1fr;
    padding: 0 var(--space-4);
  }
  .signature {
    display: none;
  }
  .nav {
    justify-self: end;
  }
  .nav-link {
    padding: var(--space-2);
  }
}
</style>
