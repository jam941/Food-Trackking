import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

// Client-side env vars only (VITE_ prefix required by Vite).
// Server-side vars (DATABASE_URL, BETTER_AUTH_SECRET, OFF_USER_AGENT)
// are accessed via process.env directly in server functions.
export const env = createEnv({
  clientPrefix: 'VITE_',

  client: {
    VITE_APP_TITLE: z.string().min(1).optional(),
  },

  runtimeEnv: import.meta.env,

  emptyStringAsUndefined: true,
})
