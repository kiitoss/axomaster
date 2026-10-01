import { nextTick, ref, watch, type Ref } from 'vue'

/**
 * Historique annuler / rétablir par instantanés JSON.
 * Les modifications rapprochées (frappe, glisser) sont regroupées en une seule étape.
 */
export function useHistory<T>(source: Ref<T>, { limit = 100, delay = 350 } = {}) {
  const past: string[] = []
  const future: string[] = []
  const canUndo = ref(false)
  const canRedo = ref(false)

  let last = JSON.stringify(source.value)
  let applying = false
  let timer: ReturnType<typeof setTimeout> | undefined

  function refresh() {
    canUndo.value = past.length > 0
    canRedo.value = future.length > 0
  }

  function commit() {
    clearTimeout(timer)
    timer = undefined
    const current = JSON.stringify(source.value)
    if (current === last) return
    past.push(last)
    if (past.length > limit) past.shift()
    future.length = 0
    last = current
    refresh()
  }

  watch(
    source,
    () => {
      if (applying) return
      clearTimeout(timer)
      timer = setTimeout(commit, delay)
    },
    { deep: true },
  )

  function apply(snapshot: string) {
    applying = true
    last = snapshot
    source.value = JSON.parse(snapshot) as T
    refresh()
    nextTick(() => (applying = false))
  }

  function undo() {
    commit()
    const previous = past.pop()
    if (previous === undefined) return
    future.push(last)
    apply(previous)
  }

  function redo() {
    commit()
    const next = future.pop()
    if (next === undefined) return
    past.push(last)
    apply(next)
  }

  function reset() {
    clearTimeout(timer)
    past.length = 0
    future.length = 0
    last = JSON.stringify(source.value)
    refresh()
  }

  return { canUndo, canRedo, undo, redo, reset, commit }
}
