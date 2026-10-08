import { newId } from '@axomaster/card-model'
import { apiUrl, put } from '@/api/client'

/**
 * Les images sont stockées par l'API (R2 ou D1) ; les cartes ne gardent que leur identifiant.
 * Un identifiant désigne toujours le même contenu : le navigateur peut les mettre en cache.
 */

export async function putImage(blob: Blob, id: string = newId()): Promise<string> {
  await put(`admin/images/${encodeURIComponent(id)}`, blob)
  return id
}

export async function getImageUrl(id: string): Promise<string | null> {
  return apiUrl(`images/${encodeURIComponent(id)}`)
}

export async function getImageDataUrl(id: string): Promise<string | null> {
  const url = await getImageUrl(id)
  if (!url) return null
  const res = await fetch(url, { credentials: 'same-origin' })
  return res.ok ? blobToDataUrl(await res.blob()) : null
}

export async function putImageDataUrl(id: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  await putImage(blob, id)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
