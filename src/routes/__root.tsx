import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
  Link,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { Toaster } from '#/components/ui/sonner'
import { authClient } from '#/lib/auth-client'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Food Trackking' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootLayout() {
  const { data: session } = authClient.useSession()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b px-4 h-14 flex items-center justify-between">
        <nav className="flex items-center gap-6">
          <Link to="/" className="font-semibold text-sm">
            🥦 Food Trackking
          </Link>
          {session && (
            <>
              <Link
                to="/pantry"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                activeProps={{ className: 'text-foreground font-medium' }}
              >
                Pantry
              </Link>
              <Link
                to="/grocery"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                activeProps={{ className: 'text-foreground font-medium' }}
              >
                Grocery
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-2">
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{session.user.email}</span>
              <button
                onClick={() => void authClient.signOut().then(() => { window.location.href = '/auth/sign-in' })}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link to="/auth/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Outlet />
      </main>
      <Toaster richColors />
      <TanStackDevtools
        config={{ position: 'bottom-right' }}
        plugins={[
          { name: 'Tanstack Router', render: <TanStackRouterDevtoolsPanel /> },
          TanStackQueryDevtools,
        ]}
      />
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
