import { createApp } from 'vue'
import { createPinia } from 'pinia'

import '@fontsource/cormorant-garamond/400.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/cormorant-garamond/600.css'
import '@fontsource/cormorant-garamond/500-italic.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import './styles/tokens.css'
import './styles/base.css'

import App from './App.vue'
import { router } from './router'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'

const app = createApp(App).use(createPinia())

const auth = useAuthStore()

setUnauthorizedHandler(() => {
  auth.user = null
  router.replace({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
})

// La session doit être connue avant la première navigation (gardes du routeur).
auth.init().then(() => app.use(router).mount('#app'))
