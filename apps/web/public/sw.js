/* Service worker d'AxoMaster : notifications push uniquement (pas de cache hors ligne).
 * Contenu des messages : voir `notifications.ts` (@axomaster/card-model). */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const scope = self.registration.scope
  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'AxoMaster', {
        body: data.body || '',
        tag: data.tag,
        icon: new URL('icon-192.png', scope).href,
        badge: new URL('badge-96.png', scope).href,
        data: { url: new URL(data.url || './', scope).href },
      }),
      // Les onglets ouverts rafraîchissent leurs pastilles (boosters, échanges).
      self.clients
        .matchAll({ type: 'window' })
        .then((windows) => windows.forEach((w) => w.postMessage({ type: 'push' }))),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Réutilise un onglet de l'app déjà ouvert plutôt que d'en ouvrir un nouveau.
      const client = windows.find((w) => w.url.startsWith(self.registration.scope))
      if (client) {
        await client.focus()
        if ('navigate' in client) await client.navigate(url)
        return
      }
      await self.clients.openWindow(url)
    })(),
  )
})
