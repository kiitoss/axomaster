import { ref, watch } from 'vue'

/** Préférence de thème : `auto` suit le réglage de l'appareil. */
export type ThemePreference = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'axomaster.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function readPreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    if (value === 'light' || value === 'dark') return value
  } catch {
    // Stockage indisponible (navigation privée…) : on suit l'appareil.
  }
  return 'auto'
}

const preference = ref<ThemePreference>(readPreference())
const media = window.matchMedia(DARK_QUERY)
const systemDark = ref(media.matches)
media.addEventListener('change', (e) => (systemDark.value = e.matches))

/** Applique le thème résolu sur `<html data-theme>` (lu par `styles/tokens.css`). */
function apply() {
  const dark = preference.value === 'dark' || (preference.value === 'auto' && systemDark.value)
  const root = document.documentElement
  root.dataset.theme = dark ? 'dark' : 'light'
  root.style.colorScheme = dark ? 'dark' : 'light'
}

watch([preference, systemDark], apply, { immediate: true })
watch(preference, (value) => {
  try {
    if (value === 'auto') localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, value)
  } catch {
    // Préférence non mémorisée : sans conséquence.
  }
})

const ORDER: ThemePreference[] = ['auto', 'light', 'dark']

export function useTheme() {
  return {
    preference,
    /** Auto → Clair → Sombre → Auto. */
    cycle() {
      preference.value = ORDER[(ORDER.indexOf(preference.value) + 1) % ORDER.length]!
    },
  }
}
