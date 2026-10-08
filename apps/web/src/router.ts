import { createRouter, createWebHashHistory } from 'vue-router'
import CatalogueView from '@/views/CatalogueView.vue'
import { useAuthStore } from '@/stores/auth'
import { useCardsStore } from '@/stores/cards'
import { useToast } from '@/composables/useToast'
import { errorMessage } from '@/api/client'

declare module 'vue-router' {
  interface RouteMeta {
    /** Accessible sans être connecté. */
    public?: boolean
    /** Réservé aux administrateurs. */
    admin?: boolean
  }
}

export const router = createRouter({
  // Hash : le site peut être servi sous n'importe quel sous-chemin.
  history: createWebHashHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },

    // Espace joueur
    { path: '/', name: 'catalogue', component: CatalogueView },
    { path: '/boosters', name: 'boosters', component: () => import('@/views/BoosterView.vue') },
    { path: '/echanges', name: 'trades', component: () => import('@/views/TradesView.vue') },

    // Administration
    {
      path: '/admin',
      name: 'gallery',
      component: () => import('@/views/GalleryView.vue'),
      meta: { admin: true },
    },
    {
      path: '/admin/editor/:id?',
      name: 'editor',
      component: () => import('@/views/EditorView.vue'),
      meta: { admin: true },
    },
    {
      path: '/admin/collections',
      name: 'collections',
      component: () => import('@/views/CollectionsView.vue'),
      meta: { admin: true },
    },
    {
      path: '/admin/joueurs',
      name: 'players',
      component: () => import('@/views/PlayersView.vue'),
      meta: { admin: true },
    },
    {
      path: '/admin/reglages',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { admin: true },
    },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (to.meta.public) return auth.user ? '/' : true
  if (!auth.user)
    return { name: 'login', query: to.fullPath !== '/' ? { redirect: to.fullPath } : {} }
  if (to.meta.admin && !auth.isAdmin) return '/'

  // Les données de l'administration sont chargées avant d'afficher la vue.
  if (to.meta.admin) {
    try {
      await useCardsStore().ensureAdminCards()
    } catch (err) {
      useToast().error(errorMessage(err))
    }
  }
  return true
})
