import { createStore, del, delMany, get, keys, set } from 'idb-keyval'
import { newId } from '@axomaster/card-model'

/**
 * Les images vivent dans IndexedDB (le localStorage est limité à ~5 Mo).
 * Les cartes ne stockent que l'identifiant de l'image.
 */
const store = createStore('axomaster', 'images')
const urlCache = new Map<string, string>()

export async function putImage(blob: Blob, id: string = newId()): Promise<string> {
  await set(id, blob, store)
  return id
}

export async function getImageUrl(id: string): Promise<string | null> {
  const cached = urlCache.get(id)
  if (cached) return cached
  const blob = await get<Blob>(id, store)
  if (!blob) return null
  const url = URL.createObjectURL(blob)
  urlCache.set(id, url)
  return url
}

export async function getImageDataUrl(id: string): Promise<string | null> {
  const blob = await get<Blob>(id, store)
  return blob ? blobToDataUrl(blob) : null
}

export async function putImageDataUrl(id: string, dataUrl: string): Promise<void> {
  const blob = await (await fetch(dataUrl)).blob()
  await set(id, blob, store)
  forget(id)
}

export async function hasImage(id: string): Promise<boolean> {
  return (await get(id, store)) !== undefined
}

export async function deleteImage(id: string): Promise<void> {
  await del(id, store)
  forget(id)
}

export async function deleteImages(ids: string[]): Promise<void> {
  if (!ids.length) return
  await delMany(ids, store)
  ids.forEach(forget)
}

export async function listImageIds(): Promise<string[]> {
  return (await keys(store)).map(String)
}

function forget(id: string) {
  const url = urlCache.get(id)
  if (url) URL.revokeObjectURL(url)
  urlCache.delete(id)
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
