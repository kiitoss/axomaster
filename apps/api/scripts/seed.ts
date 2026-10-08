/**
 * Comptes de démonstration pour la base locale uniquement :
 * admin / admin1234, alice / alice1234, bob / bob12345.
 * Les cartes d'exemple se chargent ensuite depuis la galerie admin (« Charger les exemples »).
 */
import { executeSql, upsertUserSql } from './d1'

if (process.argv.includes('--remote')) {
  console.error('Le jeu de démonstration ne doit pas être chargé en production.')
  process.exit(1)
}

executeSql(
  await Promise.all([
    upsertUserSql({
      username: 'admin',
      displayName: 'Administrateur',
      password: 'admin1234',
      role: 'admin',
    }),
    upsertUserSql({
      username: 'alice',
      displayName: 'Alice Martin',
      password: 'alice1234',
      role: 'player',
    }),
    upsertUserSql({
      username: 'bob',
      displayName: 'Bob Durand',
      password: 'bob12345',
      role: 'player',
    }),
  ]),
  false,
)
console.log('Comptes créés : admin / admin1234, alice / alice1234, bob / bob12345')
