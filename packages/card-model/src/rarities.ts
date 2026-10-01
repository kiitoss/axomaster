import { RARITIES } from './schema'
import type { Rarity } from './types'

export interface RarityInfo {
  label: string
  /** Rang, 1 = la plus commune. */
  rank: number
  /** Couleur principale (liseré, losanges). */
  color: string
  /** Dégradé du cadre, du haut-gauche vers le bas-droit. */
  frame: string[]
  /** Intensité de l'effet holographique, 0–1. */
  holo: number
}

export const RARITY_INFO: Record<Rarity, RarityInfo> = {
  common: {
    label: 'Commune',
    rank: 1,
    color: '#8c877d',
    frame: ['#ebe6dc', '#d3ccbf', '#e4ded2'],
    holo: 0.15,
  },
  uncommon: {
    label: 'Peu commune',
    rank: 2,
    color: '#5d7d68',
    frame: ['#d3ded5', '#86a08e', '#c3d1c6'],
    holo: 0.3,
  },
  rare: {
    label: 'Rare',
    rank: 3,
    color: '#3f5d8c',
    frame: ['#d0d9e8', '#5f789f', '#bccadf'],
    holo: 0.5,
  },
  epic: {
    label: 'Épique',
    rank: 4,
    color: '#6d4f8f',
    frame: ['#ddd1e8', '#7c6198', '#cbbbdc'],
    holo: 0.7,
  },
  legendary: {
    label: 'Légendaire',
    rank: 5,
    color: '#a8832f',
    frame: ['#f4e4b0', '#b8913f', '#f1d68e', '#9c7a30'],
    holo: 1,
  },
}

export const RARITY_LIST: Rarity[] = [...RARITIES]
