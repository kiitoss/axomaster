/** Copie profonde d'une donnée sérialisable (fonctionne aussi sur les proxys réactifs). */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
