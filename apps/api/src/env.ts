import type { SessionUser } from '@axomaster/card-model'

export interface Env {
  DB: D1Database
  /** Bucket R2 optionnel ; à défaut, les images sont stockées dans D1. */
  IMAGES?: R2Bucket
  ASSETS: Fetcher
  /** Clés VAPID (base64url) : sans elles, les notifications push sont désactivées. */
  VAPID_PUBLIC_KEY?: string
  VAPID_PRIVATE_KEY?: string
  /** Contact transmis aux services de push (`mailto:…` ou URL https). */
  VAPID_SUBJECT?: string
}

export interface AppEnv {
  Bindings: Env
  Variables: { user: SessionUser }
}
