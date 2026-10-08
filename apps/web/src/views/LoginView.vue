<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LogIn } from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/api/client'
import CardBack from '@/components/booster/CardBack.vue'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const username = ref('')
const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!username.value.trim() || !password.value) return
  busy.value = true
  error.value = ''
  try {
    await auth.login(username.value.trim(), password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    // Seuls les chemins internes sont acceptés.
    router.replace(redirect.startsWith('/') ? redirect : auth.isAdmin ? '/admin' : '/')
  } catch (err) {
    error.value = errorMessage(err)
    password.value = ''
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="login">
    <div class="deck" aria-hidden="true">
      <div class="deck-card"><CardBack /></div>
      <div class="deck-card"><CardBack /></div>
      <div class="deck-card"><CardBack /></div>
    </div>

    <form class="panel" @submit.prevent="submit">
      <p class="eyebrow">Jeu de cartes</p>
      <h1>AxoMaster</h1>
      <p class="muted lead">Collectionnez, ouvrez des boosters et échangez vos cartes.</p>

      <div class="field">
        <label for="login-username">Identifiant</label>
        <input
          id="login-username"
          v-model="username"
          class="input"
          autocomplete="username"
          autocapitalize="none"
          spellcheck="false"
          required
        />
      </div>
      <div class="field">
        <label for="login-password">Mot de passe</label>
        <input
          id="login-password"
          v-model="password"
          class="input"
          type="password"
          autocomplete="current-password"
          required
        />
      </div>

      <p v-if="error" class="error" role="alert">{{ error }}</p>

      <button class="btn btn-primary submit" type="submit" :disabled="busy">
        <LogIn /> {{ busy ? 'Connexion…' : 'Se connecter' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.login {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: var(--space-7);
  max-width: 980px;
  min-height: 100dvh;
  margin: 0 auto;
  padding: var(--space-6);
}

.deck {
  position: relative;
  justify-self: center;
  width: min(300px, 100%);
  aspect-ratio: 630 / 880;
}

.deck-card {
  position: absolute;
  inset: 0;
  border-radius: 12px;
  box-shadow: var(--shadow);
}

.deck-card:nth-child(1) {
  transform: rotate(-9deg) translateX(-12%);
}

.deck-card:nth-child(2) {
  transform: rotate(4deg) translateX(10%);
}

.panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 380px;
}

h1 {
  font-size: 56px;
  font-weight: 500;
  line-height: 1;
}

.lead {
  margin-top: calc(-1 * var(--space-2));
  margin-bottom: var(--space-2);
}

.error {
  color: var(--danger);
  font-size: 13px;
}

.submit {
  align-self: flex-start;
}

@media (max-width: 860px) {
  .login {
    grid-template-columns: 1fr;
    align-content: center;
    gap: var(--space-6);
    padding: var(--space-6) var(--space-4) calc(var(--space-6) + env(safe-area-inset-bottom));
  }

  .deck {
    width: 140px;
  }

  .panel {
    max-width: none;
    width: 100%;
  }

  h1 {
    font-size: 44px;
  }

  .submit {
    align-self: stretch;
  }
}
</style>
