import { putImage } from '@/storage/imageStore'
import { compressImage, pickFile } from './image'

export interface UploadedImage {
  id: string
  /** Largeur / hauteur. */
  ratio: number
}

/** Demande une image à l'utilisateur, la compresse et la stocke. `null` si annulé. */
export async function uploadImage(file?: File | null): Promise<UploadedImage | null> {
  const source = file ?? (await pickFile())
  if (!source) return null
  const blob = await compressImage(source)
  const bitmap = await createImageBitmap(blob)
  const ratio = bitmap.width / bitmap.height
  bitmap.close()
  return { id: await putImage(blob), ratio }
}
