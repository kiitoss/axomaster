import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hashPassword } from '../src/lib/password'

const apiDir = fileURLToPath(new URL('..', import.meta.url))
// On lance wrangler avec Node directement : pas de shell, donc pas de souci d'échappement.
const wranglerBin = join(apiDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js')

/** Échappe une valeur pour un littéral SQL. */
export function sql(value: string | number | null) {
  if (value === null) return 'NULL'
  if (typeof value === 'number') return String(value)
  return `'${value.replaceAll("'", "''")}'`
}

/** Exécute un script SQL sur la base D1 locale (ou distante) via wrangler. */
export function executeSql(statements: string[], remote: boolean) {
  const dir = mkdtempSync(join(tmpdir(), 'axomaster-'))
  const file = join(dir, 'script.sql')
  writeFileSync(file, statements.join('\n'))
  try {
    const result = spawnSync(
      process.execPath,
      [
        wranglerBin,
        'd1',
        'execute',
        'axomaster',
        remote ? '--remote' : '--local',
        `--file=${file}`,
      ],
      { cwd: apiDir, stdio: 'inherit' },
    )
    if (result.status !== 0) throw new Error('wrangler d1 execute a échoué')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

export interface NewUser {
  username: string
  displayName: string
  password: string
  role: 'admin' | 'player'
}

/** Instruction d'insertion d'un compte (ou de mise à jour du mot de passe s'il existe). */
export async function upsertUserSql(user: NewUser) {
  const now = new Date()
  // Un booster disponible dès la première connexion (cf. initialBoosterAnchor).
  const anchor = new Date(now.getTime() - 86_400_000).toISOString()
  return `INSERT INTO users (id, username, display_name, role, password_hash, booster_anchor, created_at)
VALUES (${sql(crypto.randomUUID())}, ${sql(user.username)}, ${sql(user.displayName)}, ${sql(user.role)},
  ${sql(await hashPassword(user.password))}, ${sql(anchor)}, ${sql(now.toISOString())})
ON CONFLICT (username) DO UPDATE SET password_hash = excluded.password_hash, role = excluded.role, disabled = 0;`
}
