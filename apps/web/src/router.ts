import { createRouter, createWebHashHistory } from 'vue-router'
import GalleryView from '@/views/GalleryView.vue'

export const router = createRouter({
  // Hash : la démo peut être hébergée sur n'importe quel serveur statique.
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'gallery', component: GalleryView },
    { path: '/editor/:id?', name: 'editor', component: () => import('@/views/EditorView.vue') },
    {
      path: '/collections',
      name: 'collections',
      component: () => import('@/views/CollectionsView.vue'),
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
