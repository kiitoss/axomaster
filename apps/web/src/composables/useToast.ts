import { ref } from 'vue'

export interface Toast {
  id: number
  message: string
  tone: 'info' | 'error'
}

const toasts = ref<Toast[]>([])
let seq = 0

export function useToast() {
  function show(message: string, tone: Toast['tone'] = 'info', duration = 3200) {
    const id = ++seq
    toasts.value.push({ id, message, tone })
    setTimeout(() => dismiss(id), duration)
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }
  return { toasts, show, error: (m: string) => show(m, 'error', 5000), dismiss }
}
