<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { BookOpen, Gift, KeyRound, List, Table2, UserPlus } from 'lucide-vue-next'
import type { AdminUser, GiftBoostersRequest, Role } from '@axomaster/card-model'
import { get, patch, post, errorMessage } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { useToast } from '@/composables/useToast'
import PlayerCollection from '@/components/players/PlayerCollection.vue'
import PlayerAvatar from '@/components/players/PlayerAvatar.vue'
import OwnershipMatrix from '@/components/players/OwnershipMatrix.vue'
import GiftForm from '@/components/players/GiftForm.vue'
import BaseDialog from '@/components/ui/BaseDialog.vue'

const auth = useAuthStore()
const toast = useToast()

const users = ref<AdminUser[]>([])
const loading = ref(true)

const form = ref({ username: '', displayName: '', password: '', role: 'player' as Role })
const creating = ref(false)
/** Liste des comptes ou tableau joueurs × cartes. */
const mode = ref<'list' | 'matrix'>('list')
/** Joueur dont on consulte la collection. */
const viewing = ref<AdminUser | null>(null)
/** Joueur à qui l'on offre des boosters. */
const gifting = ref<AdminUser | null>(null)
const giftBusy = ref(false)

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

async function gift(request: Required<GiftBoostersRequest>) {
  const user = gifting.value
  if (!user) return
  giftBusy.value = true
  try {
    await post(`admin/users/${encodeURIComponent(user.id)}/boosters/gift`, request)
    const n = request.count
    toast.show(`${n} booster${n > 1 ? 's' : ''} offert${n > 1 ? 's' : ''} à ${user.displayName}`)
    gifting.value = null
    await load()
  } catch (err) {
    toast.error(errorMessage(err))
  } finally {
    giftBusy.value = false
  }
}

function toggleDisabled(user: AdminUser) {
  const disabled = !user.disabled
  if (disabled && !confirm(`Désactiver le compte de ${user.displayName} ?`)) return
  update(user, { disabled }, disabled ? 'Compte désactivé' : 'Compte réactivé')
}
</script>

<template>
  <div class="page" :class="{ wide: mode === 'matrix' }">
    <div class="segmented modes" role="group" aria-label="Affichage">
      <button type="button" :class="{ active: mode === 'list' }" @click="mode = 'list'">
        <List /> Comptes
      </button>
      <button type="button" :class="{ active: mode === 'matrix' }" @click="mode = 'matrix'">
        <Table2 /> Tableau des cartes
      </button>
    </div>

    <OwnershipMatrix v-if="mode === 'matrix' && !loading" :users="users" @view="viewing = $event" />

    <form v-if="mode === 'list'" class="create" @submit.prevent="create">
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

    <ul v-else-if="mode === 'list'" class="list">
      <li v-for="user in users" :key="user.id" class="item" :class="{ disabled: user.disabled }">
        <PlayerAvatar :id="user.id" :name="user.displayName" :size="36" />
        <div class="who">
          <button class="name" type="button" title="Renommer" @click="rename(user)">
            {{ user.displayName }}
          </button>
          <span class="muted">
            {{ user.username }} · {{ user.role === 'admin' ? 'Administrateur' : 'Joueur' }}
            <template v-if="user.disabled"> · désactivé</template>
          </span>
        </div>
        <button
          class="stats"
          type="button"
          title="Voir les cartes débloquées et manquantes"
          @click="viewing = user"
        >
          <BookOpen />
          {{ user.distinctCards }} carte{{ user.distinctCards > 1 ? 's' : '' }} ·
          {{ user.totalCards }} ex.
          <template v-if="user.bonusBoosters">
            · {{ user.bonusBoosters }} booster{{ user.bonusBoosters > 1 ? 's' : '' }} offert{{
              user.bonusBoosters > 1 ? 's' : ''
            }}
          </template>
        </button>
        <div class="actions">
          <button
            v-if="!user.disabled"
            class="btn btn-ghost btn-icon btn-sm"
            type="button"
            title="Offrir des boosters"
            aria-label="Offrir des boosters"
            @click="gifting = user"
          >
            <Gift />
          </button>
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

    <PlayerCollection :user="viewing" @close="viewing = null" />

    <BaseDialog
      :open="!!gifting"
      :title="gifting ? `Offrir des boosters à ${gifting.displayName}` : ''"
      width="720px"
      @close="gifting = null"
    >
      <GiftForm
        v-if="gifting"
        :key="gifting.id"
        id-prefix="player-gift"
        submit-label="Offrir"
        :busy="giftBusy"
        @submit="gift"
      />
    </BaseDialog>
  </div>
</template>

<style scoped>
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: var(--space-5) var(--space-6) var(--space-7);
}

/* Le tableau des cartes profite de toute la largeur disponible. */
.page.wide {
  max-width: 1600px;
}

.modes {
  margin-bottom: var(--space-5);
}

.modes button {
  height: 32px;
  white-space: nowrap;
  padding: 0 var(--space-3);
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
  grid-template-columns: auto 1fr auto auto;
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
  font: 600 16px var(--font-display);
  color: var(--ink);
  cursor: pointer;
}

.name:hover {
  text-decoration: underline;
  text-decoration-color: var(--line-strong);
}

.who .muted {
  font-size: 12px;
}

.stats {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  font: 500 12px var(--font-sans);
  color: var(--ink-2);
  cursor: pointer;
}

.stats:hover {
  border-color: var(--accent);
  color: var(--accent-strong);
}

.stats svg {
  width: 14px;
  height: 14px;
  color: var(--accent);
}

.actions {
  display: flex;
  gap: var(--space-1);
}

@media (max-width: 860px) {
  .page {
    padding: var(--space-5) var(--space-4) var(--space-6);
  }

  .create {
    grid-template-columns: 1fr;
  }

  .item {
    grid-template-columns: auto 1fr;
    gap: var(--space-2) var(--space-3);
  }

  .stats,
  .actions {
    grid-column: 1 / -1;
  }

  .actions {
    flex-wrap: wrap;
  }

  .stats {
    justify-self: start;
    min-height: 36px;
  }
}
</style>
