import { ref, watch, type Ref } from 'vue'
import { getImageUrl } from '@/storage/imageStore'

/** URL affichable (object URL) d'une image stockée, mise à jour quand l'id change. */
export function useImageUrl(id: () => string | null | undefined): Ref<string | null> {
  const url = ref<string | null>(null)
  let token = 0
  watch(
    id,
    async (value) => {
      const current = ++token
      const next = value ? await getImageUrl(value) : null
      if (current === token) url.value = next
    },
    { immediate: true },
  )
  return url
}
