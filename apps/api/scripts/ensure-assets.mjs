// `wrangler dev` exige que le dossier d'assets existe, même quand le front est servi par Vite.
import { mkdirSync } from 'node:fs'

mkdirSync(new URL('../../web/dist', import.meta.url), { recursive: true })
