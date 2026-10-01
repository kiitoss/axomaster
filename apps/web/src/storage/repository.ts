import type { Card, Category } from '@axomaster/card-model'

export interface LibraryState {
  cards: Card[]
  categories: Category[] | null
  author: string
}

/**
 * Accès aux données de la bibliothèque. Implémentation actuelle : localStorage.
 * Une implémentation HTTP pourra remplacer celle-ci quand le back existera.
 */
export interface CardRepository {
  load(): LibraryState
  saveCards(cards: Card[]): void
  saveCategories(categories: Category[]): void
  saveAuthor(author: string): void
}

const PREFIX = 'axomaster:v1:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw == null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch (err) {
    console.error(`Impossible d'enregistrer « ${key} » dans le localStorage`, err)
    throw err
  }
}

export const localRepository: CardRepository = {
  load: () => ({
    cards: read<Card[]>('cards', []),
    categories: read<Category[] | null>('categories', null),
    author: read<string>('author', ''),
  }),
  saveCards: (cards) => write('cards', cards),
  saveCategories: (categories) => write('categories', categories),
  saveAuthor: (author) => write('author', author),
}
