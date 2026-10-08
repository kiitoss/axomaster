import type { Env } from '../env'
import { placeholders } from './http'

/** Stockage des images de cartes : R2 si le bucket est configuré, sinon une table D1. */
export interface ImageStorage {
  put(id: string, data: ArrayBuffer, contentType: string): Promise<void>
  get(id: string): Promise<{ body: ArrayBuffer | ReadableStream; contentType: string } | null>
  /** Images créées avant `before` (les envois récents peuvent appartenir à un brouillon en cours). */
  listOlderThan(before: Date): Promise<string[]>
  delete(ids: string[]): Promise<void>
}

/** Les images sont compressées côté client (WebP ≤ 1200 px) ; D1 limite une valeur à 2 Mo. */
export const MAX_IMAGE_BYTES = 1_800_000

export function imageStorage(env: Env): ImageStorage {
  return env.IMAGES ? r2Storage(env.IMAGES) : d1Storage(env.DB)
}

function r2Storage(bucket: R2Bucket): ImageStorage {
  return {
    async put(id, data, contentType) {
      await bucket.put(id, data, { httpMetadata: { contentType } })
    },
    async get(id) {
      const object = await bucket.get(id)
      if (!object) return null
      return {
        body: object.body,
        contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      }
    },
    async listOlderThan(before) {
      const ids: string[] = []
      let cursor: string | undefined
      do {
        const page = await bucket.list({ cursor, limit: 1000 })
        for (const object of page.objects) if (object.uploaded < before) ids.push(object.key)
        cursor = page.truncated ? page.cursor : undefined
      } while (cursor)
      return ids
    },
    async delete(ids) {
      for (let i = 0; i < ids.length; i += 1000) await bucket.delete(ids.slice(i, i + 1000))
    },
  }
}

function d1Storage(db: D1Database): ImageStorage {
  return {
    async put(id, data, contentType) {
      await db
        .prepare(
          `INSERT INTO images (id, content_type, data, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT (id) DO UPDATE SET content_type = excluded.content_type, data = excluded.data`,
        )
        .bind(id, contentType, data, new Date().toISOString())
        .run()
    },
    async get(id) {
      const row = await db
        .prepare('SELECT content_type, data FROM images WHERE id = ?')
        .bind(id)
        .first<{ content_type: string; data: ArrayBuffer | number[] }>()
      if (!row) return null
      // Selon l'environnement, D1 renvoie un BLOB en ArrayBuffer ou en tableau d'octets.
      const body = row.data instanceof ArrayBuffer ? row.data : new Uint8Array(row.data).buffer
      return { body, contentType: row.content_type }
    },
    async listOlderThan(before) {
      const { results } = await db
        .prepare('SELECT id FROM images WHERE created_at < ?')
        .bind(before.toISOString())
        .all<{ id: string }>()
      return results.map((r) => r.id)
    },
    async delete(ids) {
      for (let i = 0; i < ids.length; i += 50) {
        const chunk = ids.slice(i, i + 50)
        await db
          .prepare(`DELETE FROM images WHERE id IN (${placeholders(chunk.length)})`)
          .bind(...chunk)
          .run()
      }
    },
  }
}
