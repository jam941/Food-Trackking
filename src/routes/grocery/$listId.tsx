import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { getSessionFn } from '#/server/session'
import {
  listGroceryListItems,
  addGroceryItem,
  toggleGroceryItem,
  removeGroceryItem,
  type GroceryListItemWithFood,
} from '#/server/functions/grocery'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Checkbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { Separator } from '#/components/ui/separator'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { UNIT_LABELS, formatQuantity } from '#/lib/units'
import type { Unit } from '#/lib/units'

export const Route = createFileRoute('/grocery/$listId')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
  },
  component: GroceryListPage,
})

function GroceryListPage() {
  const { listId } = Route.useParams()
  const router = useRouter()
  const qc = useQueryClient()
  const queryKey = ['grocery-items', listId]

  const { data: items = [] } = useQuery({
    queryKey,
    queryFn: () => listGroceryListItems({ data: { listId } }),
  })

  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('1')
  const [adding, setAdding] = useState(false)

  const toggle = useMutation({
    mutationFn: ({ id, checked }: { id: string; checked: boolean }) =>
      toggleGroceryItem({ data: { id, checked } }),
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey })
      const prev = qc.getQueryData<GroceryListItemWithFood[]>(queryKey)
      qc.setQueryData<GroceryListItemWithFood[]>(queryKey, (old = []) =>
        old.map((i) => (i.id === id ? { ...i, checked } : i)),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(queryKey, ctx?.prev)
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey }) },
  })

  const remove = useMutation({
    mutationFn: (id: string) => removeGroceryItem({ data: { id } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey }) },
    onError: () => toast.error('Failed to remove item'),
  })

  async function handleAdd() {
    const name = label.trim()
    if (!name) return
    setAdding(true)
    try {
      await addGroceryItem({
        data: { listId, customLabel: name, quantity: parseFloat(qty) || 1, unit: 'piece' },
      })
      setLabel('')
      setQty('1')
      void qc.invalidateQueries({ queryKey })
    } catch {
      toast.error('Failed to add item')
    } finally {
      setAdding(false)
    }
  }

  const unchecked = items.filter((i) => !i.checked)
  const checked = items.filter((i) => i.checked)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
          ← Back
        </Button>
        <h1 className="text-xl font-bold">Grocery list</h1>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Add item…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleAdd() }}
        />
        <Input
          type="number"
          min="0.1"
          step="0.1"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-20"
        />
        <Button onClick={() => void handleAdd()} disabled={adding || !label.trim()}>
          Add
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-center py-10 text-muted-foreground">No items yet.</p>
      )}

      <div className="space-y-px">
        {unchecked.map((item, i) => (
          <div key={item.id}>
            {i > 0 && <Separator />}
            <GroceryItemRow
              item={item}
              onToggle={(checked) => toggle.mutate({ id: item.id, checked })}
              onRemove={() => remove.mutate(item.id)}
            />
          </div>
        ))}
      </div>

      {checked.length > 0 && (
        <div className="space-y-px opacity-50">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Checked off</p>
          {checked.map((item, i) => (
            <div key={item.id}>
              {i > 0 && <Separator />}
              <GroceryItemRow
                item={item}
                onToggle={(ch) => toggle.mutate({ id: item.id, checked: ch })}
                onRemove={() => remove.mutate(item.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function GroceryItemRow({
  item,
  onToggle,
  onRemove,
}: {
  item: GroceryListItemWithFood
  onToggle: (checked: boolean) => void
  onRemove: () => void
}) {
  const displayName = item.foodName ?? item.customLabel ?? 'Item'
  const unitLabel = UNIT_LABELS[item.unit as Unit] ?? item.unit

  return (
    <div className="flex items-center gap-3 py-3">
      <Checkbox
        id={item.id}
        checked={item.checked}
        onCheckedChange={(v) => onToggle(Boolean(v))}
      />
      <Label
        htmlFor={item.id}
        className={`flex-1 text-sm cursor-pointer ${item.checked ? 'line-through text-muted-foreground' : ''}`}
      >
        {displayName}
        <span className="text-muted-foreground ml-2 text-xs">
          {formatQuantity(item.quantity)} {unitLabel}
        </span>
      </Label>
      <button
        onClick={onRemove}
        className="text-muted-foreground hover:text-destructive text-xs"
      >
        ✕
      </button>
    </div>
  )
}
