import { fileURLToPath } from 'node:url'
import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'

export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)))
  return {
    test: {
      setupFiles: ['./test/apply-migrations.ts'],
      poolOptions: {
        workers: {
          singleWorker: true,
          wrangler: { configPath: './wrangler.jsonc' },
          miniflare: {
            bindings: {
              TEST_MIGRATIONS: migrations,
              // Mêmes clés que test/push-helpers.ts.
              VAPID_PUBLIC_KEY:
                'BKgZAxussPn01xfamSN8kIieyLLumDTOJOawtVABUo2MDodsmLgY1qjjEJq-GQUrHWyUiEAhnSmbHq3Ceu15JUE',
              VAPID_PRIVATE_KEY: 'WDhlKsdgVCIE0_ZT7ce90KZKzsY4DtRB_9tDcFVc-yo',
              VAPID_SUBJECT: 'mailto:test@axomaster.test',
            },
          },
        },
      },
    },
  }
})
