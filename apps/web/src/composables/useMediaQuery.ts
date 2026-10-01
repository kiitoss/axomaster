import { onBeforeUnmount, ref } from 'vue'

/** Point de rupture « mobile », partagé avec les media queries CSS (max-width: 860px). */
export const MOBILE_QUERY = '(max-width: 860px)'

export function useMediaQuery(query: string) {
  const media = window.matchMedia(query)
  const matches = ref(media.matches)
  const update = (e: MediaQueryListEvent) => (matches.value = e.matches)
  media.addEventListener('change', update)
  onBeforeUnmount(() => media.removeEventListener('change', update))
  return matches
}
