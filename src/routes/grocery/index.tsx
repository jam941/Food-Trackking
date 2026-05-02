import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useState } from 'react'
import { toast } from 'sonner'
import { getSessionFn } from '#/server/session'
import { createGroceryList, deleteGroceryList } from '#/server/functions/grocery'
import { groceryListCollection } from '#/db-collections'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import { ClientOnly } from '#/components/ClientOnly'

export const Route = createFileRoute('/grocery/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
  },
  component: () => <ClientOnly><GroceryPage /></ClientOnly>,
})

function GroceryPage() {
  const [newListName, setNewListName] = useState('')
  const [creating, setCreating] = useState(false)
  const { data: lists = [] } = useLiveQuery(groceryListCollection)

  async function handleCreate() {
    const name = newListName.trim()
    if (!name) return
    setCreating(true)
    try {
      await createGroceryList({ data: { name } })
      setNewListName('')
      toast.success(`"${name}" created`)
    } catch {
      toast.error('Failed to create list')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return
    try {
      await deleteGroceryList({ data: { id } })
      toast.success('List deleted')
    } catch {
      toast.error('Failed to delete list')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Grocery Lists</h1>

      <div className="flex gap-2">
        <Input
          placeholder="New list name…"
          value={newListName}
          onChange={(e) => setNewListName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleCreate() }}
        />
        <Button onClick={() => void handleCreate()} disabled={creating || !newListName.trim()}>
          Create
        </Button>
      </div>

      {lists.length === 0 && (
        <p className="text-center py-12 text-muted-foreground">No lists yet. Create one above.</p>
      )}

      <div className="space-y-3">
        {lists.map((list) => (
          <Card key={list.id}>
            <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium">
                <Link
                  to="/grocery/$listId"
                  params={{ listId: list.id }}
                  className="hover:underline"
                >
                  {list.name}
                </Link>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Link
                  to="/grocery/$listId"
                  params={{ listId: list.id }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Open →
                </Link>
                <button
                  onClick={() => void handleDelete(list.id, list.name)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Delete
                </button>
              </div>
            </CardHeader>
            {list.forDate && (
              <CardContent className="py-0 pb-3 px-4">
                <p className="text-xs text-muted-foreground">
                  For {new Date(list.forDate).toLocaleDateString()}
                </p>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
