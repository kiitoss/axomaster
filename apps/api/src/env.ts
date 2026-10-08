import type { SessionUser } from '@axomaster/card-model'

export interface Env {
  DB: D1Database
  /** Bucket R2 optionnel ; à défaut, les images sont stockées dans D1. */
  IMAGES?: R2Bucket
  ASSETS: Fetcher
}

export interface AppEnv {
  Bindings: Env
  Variables: { user: SessionUser }
}
