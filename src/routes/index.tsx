import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { pantryCollection } from '#/db-collections'
import { getSessionFn } from '#/server/session'
import { ClientOnly } from '#/components/ClientOnly'

export const Route = createFileRoute('/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
    return { session }
  },
  component: () => <ClientOnly><Dashboard /></ClientOnly>,
})

function Dashboard() {
  const now = new Date()
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)

  const { data: allItems = [] } = useLiveQuery(pantryCollection)
  const expiringItems = allItems.filter(
    (item) => item.expiresAt !== null && new Date(item.expiresAt) <= threeDays,
  )

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid gap-4 grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pantry items
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{allItems.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Expiring soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-500">
              {expiringItems.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {expiringItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring within 3 days</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {expiringItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.foodName}</span>
                <Badge variant="outline" className="text-orange-500">
                  {item.expiresAt
                    ? new Date(item.expiresAt).toLocaleDateString()
                    : ''}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Link
          to="/pantry"
          className="flex-1 flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          Manage Pantry
        </Link>
        <Link
          to="/grocery"
          className="flex-1 flex items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-3 text-sm font-medium hover:bg-accent transition-colors"
        >
          Grocery Lists
        </Link>
      </div>
    </div>
  )
}
