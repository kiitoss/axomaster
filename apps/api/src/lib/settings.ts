import type { BoosterSettings } from '@axomaster/card-model'

const KEYS = {
  intervalSeconds: 'booster_interval_seconds',
  maxStock: 'booster_max_stock',
  size: 'booster_size',
} as const satisfies Record<keyof BoosterSettings, string>

const DEFAULTS: BoosterSettings = { intervalSeconds: 86_400, maxStock: 3, size: 5 }

const FIELDS = Object.entries(KEYS) as [keyof BoosterSettings, string][]

export async function loadSettings(db: D1Database): Promise<BoosterSettings> {
  const { results } = await db
    .prepare('SELECT key, value FROM settings')
    .all<{ key: string; value: string }>()
  const values = new Map(results.map((r) => [r.key, Number(r.value)]))
  const settings = { ...DEFAULTS }
  for (const [field, key] of FIELDS) {
    const value = values.get(key)
    if (value !== undefined && Number.isFinite(value)) settings[field] = value
  }
  return settings
}

export async function saveSettings(db: D1Database, settings: BoosterSettings) {
  await db.batch(
    FIELDS.map(([field, key]) =>
      db
        .prepare(
          'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
        )
        .bind(key, String(settings[field])),
    ),
  )
}
