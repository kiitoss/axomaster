/**
 * Crée un compte (ou réinitialise son mot de passe) directement en base.
 *
 *   pnpm --filter @axomaster/api create-user <identifiant> [--admin] [--remote]
 *     [--name "Nom affiché"] [--password <mot de passe>]
 *
 * Sans --password, le mot de passe est demandé dans le terminal.
 */
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { executeSql, upsertUserSql } from './d1'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    admin: { type: 'boolean', default: false },
    remote: { type: 'boolean', default: false },
    name: { type: 'string' },
    password: { type: 'string' },
  },
})

const username = positionals[0]
if (!username || !/^[a-z0-9._-]{2,40}$/i.test(username)) {
  console.error(
    'Usage : create-user <identifiant> [--admin] [--remote] [--name "Nom"] [--password …]',
  )
  process.exit(1)
}

let password = values.password
if (!password) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  password = await rl.question(`Mot de passe pour ${username} : `)
  rl.close()
}
if (password.length < 8) {
  console.error('Le mot de passe doit faire au moins 8 caractères.')
  process.exit(1)
}

const role = values.admin ? 'admin' : 'player'
executeSql(
  [await upsertUserSql({ username, displayName: values.name ?? username, password, role })],
  values.remote,
)
console.log(`Compte ${role} « ${username} » prêt (${values.remote ? 'production' : 'local'}).`)
