import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { SessionUser } from '@axomaster/card-model'
import { ApiError, get, post } from '@/api/client'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null)

  const isAdmin = computed(() => user.value?.role === 'admin')

  /** Récupère la session existante (cookie) au démarrage. */
  async function init() {
    try {
      user.value = await get<SessionUser>('auth/me')
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) console.error(err)
      user.value = null
    }
  }

  async function login(username: string, password: string) {
    user.value = await post<SessionUser>('auth/login', { username, password })
  }

  async function logout() {
    try {
      await post('auth/logout')
    } finally {
      // Repart d'un état vierge : aucune donnée de l'ancien compte ne reste en mémoire.
      user.value = null
      window.location.reload()
    }
  }

  return { user, isAdmin, init, login, logout }
})
