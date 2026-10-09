import { computed, ref } from 'vue'
import type { NotificationPayload, PushConfig } from '@axomaster/card-model'
import { del, get, post } from '@/api/client'

/**
 * Notifications push : enregistrement du service worker (`public/sw.js`) et abonnement de
 * l'appareil. Un seul interrupteur par appareil ; c'est le serveur qui décide quoi envoyer.
 */

const capable = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** iOS n'autorise le push qu'une fois l'app ajoutée à l'écran d'accueil. */
const isIos =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const publicKey = ref<string | null>(null)
const subscribed = ref(false)
const permission = ref<NotificationPermission>(capable ? Notification.permission : 'default')
const busy = ref(false)

let registration: Promise<ServiceWorkerRegistration | null> = Promise.resolve(null)

/** À appeler une fois au démarrage (chemin relatif : l'app peut vivre dans un sous-dossier). */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  registration = navigator.serviceWorker.register('./sw.js').catch((err) => {
    console.error('Service worker non enregistré', err)
    return null
  })
}

function keyBytes(base64url: string) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

function sameKey(subscription: PushSubscription, key: string) {
  const current = subscription.options.applicationServerKey
  if (!current) return true
  const a = new Uint8Array(current)
  const b = keyBytes(key)
  return a.length === b.length && a.every((byte, i) => byte === b[i])
}

async function currentSubscription() {
  const reg = await registration
  return reg ? reg.pushManager.getSubscription() : null
}

/**
 * Synchronise l'état avec l'appareil et rattache l'abonnement existant au compte connecté
 * (un autre compte a pu l'utiliser sur ce même appareil).
 */
async function refresh() {
  try {
    publicKey.value ??= (await get<PushConfig>('push/config')).publicKey
    if (!capable || !publicKey.value) return
    permission.value = Notification.permission
    const subscription = await currentSubscription()
    if (subscription && !sameKey(subscription, publicKey.value)) {
      // Clés VAPID changées côté serveur : l'ancien abonnement ne recevra plus rien.
      await subscription.unsubscribe()
      subscribed.value = false
      return
    }
    subscribed.value = !!subscription && permission.value === 'granted'
    if (subscribed.value) await post('push/subscriptions', subscription!.toJSON())
  } catch (err) {
    console.error(err)
  }
}

export type EnableResult = 'ok' | 'install' | 'denied' | 'unavailable'

async function enable(): Promise<EnableResult> {
  if (!publicKey.value) return 'unavailable'
  if (!capable) return isIos && !standalone ? 'install' : 'unavailable'
  busy.value = true
  try {
    // Doit rester dans le geste de l'utilisateur (clic) : pas d'await avant cette demande.
    permission.value = await Notification.requestPermission()
    if (permission.value !== 'granted') return 'denied'
    const reg = await registration
    if (!reg) return 'unavailable'
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey.value),
      }))
    await post('push/subscriptions', subscription.toJSON())
    subscribed.value = true
    return 'ok'
  } finally {
    busy.value = false
  }
}

async function disable() {
  busy.value = true
  try {
    const subscription = await currentSubscription()
    if (subscription) {
      await del('push/subscriptions', { endpoint: subscription.endpoint }).catch(() => {})
      await subscription.unsubscribe()
    }
  } catch (err) {
    console.error(err)
  } finally {
    subscribed.value = false
    busy.value = false
  }
}

/** Affiche une notification sur cet appareil seulement (aperçu admin). */
async function showLocal(payload: NotificationPayload) {
  const reg = await registration
  if (!reg || Notification.permission !== 'granted') return false
  await reg.showNotification(payload.title, {
    body: payload.body,
    tag: payload.tag,
    icon: new URL('icon-192.png', reg.scope).href,
    badge: new URL('badge-96.png', reg.scope).href,
    data: { url: new URL(payload.url, reg.scope).href },
  })
  return true
}

export function usePush() {
  return {
    /** Le serveur envoie des notifications et l'appareil peut les recevoir (ou après installation). */
    available: computed(() => !!publicKey.value && (capable || (isIos && !standalone))),
    subscribed,
    permission,
    busy,
    refresh,
    enable,
    disable,
    showLocal,
  }
}
