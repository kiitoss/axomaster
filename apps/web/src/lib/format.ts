/** Durée lisible : « 7 jours », « 12 heures », « 1 jour ». */
export function formatDuration(seconds: number): string {
  const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`
  if (seconds % 86_400 === 0) return plural(seconds / 86_400, 'jour')
  if (seconds % 3600 === 0) return plural(seconds / 3600, 'heure')
  return plural(Math.round(seconds / 60), 'minute')
}

/** Date et heure courtes : « jeu. 16 oct. à 14:30 ». */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  const day = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${time}`
}
