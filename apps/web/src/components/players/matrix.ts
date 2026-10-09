import type { Card } from '@axomaster/card-model'

/** Colonne du tableau joueurs × cartes : la carte si on peut la montrer, sinon son dos. */
export interface MatrixColumn {
  id: string
  card?: Card
  /** Infobulle de l'en-tête. */
  label: string
  /** Numéro affiché sur le dos. */
  number: number | null
  /** Couleur de la collection (anneau du dos). */
  color?: string
  /** Carte atténuée (brouillon). */
  dim?: boolean
  /** Première carte d'une collection : séparation visuelle. */
  groupStart?: boolean
}

export interface MatrixRow {
  id: string
  name: string
  total: number
  /** Rang (pastille sur l'avatar), absent si le tableau n'est pas un classement. */
  rank?: number
  me?: boolean
  disabled?: boolean
  /** Exemplaires possédés par carte (absente = non possédée). */
  quantities: Map<string, number>
}
