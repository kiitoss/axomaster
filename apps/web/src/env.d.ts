/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Tag Git publié (injecté par le workflow de déploiement), absent en local. */
  readonly VITE_APP_VERSION?: string
}
