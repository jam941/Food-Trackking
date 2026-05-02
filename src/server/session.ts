import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth'

/** Call from UI to check/get the current session (null if not signed in). */
export const getSessionFn = createServerFn().handler(async () => {
  const request = getRequest()
  return auth.api.getSession({ headers: request.headers })
})

/** Call from within other server function handlers to get a required session. Throws on unauthenticated. */
export async function requireSession() {
  const request = getRequest()
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) throw new Error('Unauthorized')
  return session
}
