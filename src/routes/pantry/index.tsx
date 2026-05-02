import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useState } from 'react'
import { toast } from 'sonner'
import { getSessionFn } from '#/server/session'
import { deletePantryItem } from '#/server/functions/pantry'
import { pantryCollection } from '#/db-collections'
import type { PantryItemWithFood } from '#/server/functions/pantry'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Separator } from '#/components/ui/separator'
import ScanSheet from '#/components/pantry/ScanSheet'
import { UNIT_LABELS } from '#/lib/units'
import type { Unit } from '#/lib/units'
import { ClientOnly } from '#/components/ClientOnly'

export const Route = createFileRoute('/pantry/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
  },
  component: () => <ClientOnly><PantryPage /></ClientOnly>,
})

function expiryBadge(expiresAt: Date | null) {
  if (!expiresAt) return null
  const days = Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  )
  if (days < 0) return <Badge variant="destructive">Expired</Badge>
  if (days <= 3) return <Badge className="bg-orange-500">Exp {days}d</Badge>
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Exp {new Date(expiresAt).toLocaleDateString()}
    </Badge>
  )
}

type LocationKey = 'pantry' | 'fridge' | 'freezer' | 'other'

function groupByLocation(items: PantryItemWithFood[]): Partial<Record<LocationKey, PantryItemWithFood[]>> {
  const result: Partial<Record<LocationKey, PantryItemWithFood[]>> = {}
  for (const item of items) {
    const key = (item.location ?? 'pantry') as LocationKey
    ;(result[key] ??= []).push(item)
  }
  return result
}

function PantryPage() {
  const [scanOpen, setScanOpen] = useState(false)
  const { data: items = [] } = useLiveQuery(pantryCollection)

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from pantry?`)) return
    try {
      await deletePantryItem({ data: { id } })
      toast.success('Removed from pantry')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  const byLocation = groupByLocation(items)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pantry</h1>
        <Button onClick={() => setScanOpen(true)} size="sm">
          + Scan
        </Button>
      </div>

      {items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <p className="text-lg">Your pantry is empty</p>
          <p className="text-sm">Tap <strong>+ Scan</strong> to scan a barcode and add your first item.</p>
        </div>
      )}

      {(['fridge', 'freezer', 'pantry', 'other'] as const).map((loc) => {
        const group = byLocation[loc]
        if (!group?.length) return null
        return (
          <section key={loc}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 capitalize">
              {loc}
            </h2>
            <div className="space-y-px">
              {group.map((item, i) => (
                <div key={item.id}>
                  {i > 0 && <Separator />}
                  <div className="flex items-center gap-3 py-3">
                    {item.foodImageUrl && (
                      <img
                        src={item.foodImageUrl}
                        alt=""
                        className="h-10 w-10 object-contain rounded flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.foodName}</p>
                      {item.foodBrand && (
                        <p className="text-xs text-muted-foreground">{item.foodBrand}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} {UNIT_LABELS[item.unit as Unit] ?? item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {expiryBadge(item.expiresAt)}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
                        onClick={() => void handleDelete(item.id, item.foodName)}
                      >
                        ✕
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <ScanSheet
        open={scanOpen}
        onOpenChange={setScanOpen}
        onAdded={() => {
          // TanStack DB invalidates automatically
        }}
      />
    </div>
  )
}
