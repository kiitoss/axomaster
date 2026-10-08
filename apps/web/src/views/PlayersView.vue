<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { KeyRound, UserPlus } from 'lucide-vue-next'
import type { AdminUser, Role } from '@axomaster/card-model'
import { get, patch, post, errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const toast = useToast()

const users = ref<AdminUser[]>([])
const loading = ref(true)

const form = ref({ username: '', displayName: '', password: '', role: 'player' as Role })
const creating = ref(false)

async function load() {
  try {
    users.value = await get<AdminUser[]>('admin/users')
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function create() {
  creating.value = true
  try {
    await post('admin/users', {
      ...form.value,
      displayName: form.value.displayName.trim() || form.value.username.trim(),
    })
    toast.show(`Compte « ${form.value.username} » créé`)
    form.value = { username: '', displayName: '', password: '', role: 'player' }
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    creating.value = false
  }
}

async function update(user: AdminUser, changes: Record<string, unknown>, done: string) {
  try {
    await patch(`admin/users/${encodeURIComponent(user.id)}`, changes)
    toast.show(done)
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  }
}

function rename(user: AdminUser) {
  const name = prompt('Nom affiché', user.displayName)?.trim()
  if (name && name !== user.displayName) update(user, { displayName: name }, 'Nom modifié')
}

function resetPassword(user: AdminUser) {
  const password = prompt(`Nouveau mot de passe pour ${user.username} (8 caractères minimum)`)
  if (password) update(user, { password }, 'Mot de passe réinitialisé, sessions fermées')
}

function toggleRole(user: AdminUser) {
  const role: Role = user.role === 'admin' ? 'player' : 'admin'
  const label = role === 'admin' ? 'administrateur' : 'joueur'
  if (confirm(`Faire de ${user.displayName} un ${label} ?`)) update(user, { role }, 'Rôle modifié')
}

function toggleDisabled(user: AdminUser) {
  const disabled = !user.disabled
  if (disabled && !confirm(`Désactiver le compte de ${user.displayName} ?`)) return
  update(user, { disabled }, disabled ? 'Compte désactivé' : 'Compte réactivé')
}
</script>

<template>
  <div class="page">
    <p class="eyebrow">Administration</p>
    <h1>Joueurs</h1>
    <p class="muted lead">
      Les comptes sont créés ici en attendant la connexion Microsoft. Chaque nouveau joueur reçoit
      un booster dès sa première connexion.
    </p>

    <form class="create" @submit.prevent="create">
      <div class="field">
        <label for="user-username">Identifiant</label>
        <input
          id="user-username"
          v-model.trim="form.username"
          class="input"
          required
          minlength="2"
          maxlength="40"
          pattern="[A-Za-z0-9._\-]+"
          autocapitalize="none"
          spellcheck="false"
        />
      </div>
      <div class="field">
        <label for="user-name">Nom affiché</label>
        <input
          id="user-name"
          v-model="form.displayName"
          class="input"
          maxlength="80"
          placeholder="Prénom Nom"
        />
      </div>
      <div class="field">
        <label for="user-password">Mot de passe initial</label>
        <input
          id="user-password"
          v-model="form.password"
          class="input"
          type="text"
          required
          minlength="8"
          autocomplete="off"
        />
      </div>
      <div class="field">
        <label for="user-role">Rôle</label>
        <select id="user-role" v-model="form.role" class="select">
          <option value="player">Joueur</option>
          <option value="admin">Administrateur</option>
        </select>
      </div>
      <button class="btn btn-primary" type="submit" :disabled="creating"><UserPlus /> Créer</button>
    </form>

    <p v-if="loading" class="muted">Chargement…</p>

    <ul v-else class="list">
      <li v-for="user in users" :key="user.id" class="item" :class="{ disabled: user.disabled }">
        <div class="who">
          <button class="name" type="button" title="Renommer" @click="rename(user)">
            {{ user.displayName }}
          </button>
          <span class="muted">
            {{ user.username }} · {{ user.role === 'admin' ? 'Administrateur' : 'Joueur' }}
            <template v-if="user.disabled"> · désactivé</template>
          </span>
        </div>
        <div class="stats muted">
          {{ user.distinctCards }} carte{{ user.distinctCards > 1 ? 's' : '' }} ·
          {{ user.totalCards }} ex.
          <template v-if="user.bonusBoosters">
            · {{ user.bonusBoosters }} booster{{ user.bonusBoosters > 1 ? 's' : '' }} offert{{
              user.bonusBoosters > 1 ? 's' : ''
            }}
          </template>
        </div>
        <div class="actions">
          <button
            class="btn btn-ghost btn-icon btn-sm"
            type="button"
            title="Réinitialiser le mot de passe"
            aria-label="Réinitialiser le mot de passe"
            @click="resetPassword(user)"
          >
            <KeyRound />
          </button>
          <template v-if="user.id !== auth.user?.id">
            <button class="btn btn-ghost btn-sm" type="button" @click="toggleRole(user)">
              {{ user.role === 'admin' ? 'Rendre joueur' : 'Rendre admin' }}
            </button>
            <button class="btn btn-ghost btn-sm" type="button" @click="toggleDisabled(user)">
              {{ user.disabled ? 'Réactiver' : 'Désactiver' }}
            </button>
          </template>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-7) var(--space-6);
}

h1 {
  font-size: 52px;
  font-weight: 500;
}

.lead {
  max-width: 560px;
  margin: var(--space-2) 0 var(--space-6);
}

.create {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  align-items: end;
  gap: var(--space-3);
  margin-bottom: var(--space-6);
  padding: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.create .field {
  margin: 0;
}

.list {
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: 1px solid var(--line);
}

.item {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--line);
}

.item.disabled .who {
  opacity: 0.5;
}

.who {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.name {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: none;
  font: 500 20px var(--font-serif);
  color: var(--ink);
  cursor: pointer;
}

.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
}

.who .muted,
.stats {
  font-size: 12px;
}

.actions {
  display: flex;
  gap: var(--space-1);
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  h1 {
    font-size: 40px;
  }

  .create {
    grid-template-columns: 1fr;
  }

  .item {
    grid-template-columns: 1fr;
    gap: var(--space-2);
  }

  .actions {
    flex-wrap: wrap;
  }
}
</style>
