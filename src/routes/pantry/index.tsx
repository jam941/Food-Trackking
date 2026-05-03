import { createFileRoute, redirect } from '@tanstack/react-router'
import { useLiveQuery } from '@tanstack/react-db'
import { useDeferredValue, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { getSessionFn } from '#/server/session'
import { deletePantryItem } from '#/server/functions/pantry'
import { pantryCollection } from '#/db-collections'
import type { PantryItemWithFood } from '#/server/functions/pantry'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import BulkScanSheet from '#/components/pantry/BulkScanSheet'
import FoodInfoPanel from '#/components/pantry/FoodInfoPanel'
import { PantryFilters } from '#/components/pantry/PantryFilters'
import { VirtualPantryList } from '#/components/pantry/VirtualPantryList'
import type { PantryRow } from '#/components/pantry/VirtualPantryList'
import { applyFilters, emptyFilters } from '#/lib/pantry-filters'
import type { FilterState, LocationKey } from '#/lib/pantry-filters'
import { ClientOnly } from '#/components/ClientOnly'

export const Route = createFileRoute('/pantry/')({
  beforeLoad: async () => {
    const session = await getSessionFn()
    if (!session) throw redirect({ to: '/auth/sign-in' })
  },
  component: () => <ClientOnly><PantryPage /></ClientOnly>,
})

const LOCATION_ORDER: LocationKey[] = ['fridge', 'freezer', 'pantry', 'other']

function PantryPage() {
  const [scanOpen, setScanOpen] = useState(false)
  const [infoItem, setInfoItem] = useState<PantryItemWithFood | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<FilterState>(emptyFilters())
  const [searchInput, setSearchInput] = useState('')
  const deferredQuery = useDeferredValue(searchInput)
  const { data: items = [] } = useLiveQuery(pantryCollection)

  const activeFilters = useMemo<FilterState>(
    () => ({ ...filters, query: deferredQuery }),
    [filters, deferredQuery],
  )

  const availableTags = useMemo(
    () => Array.from(new Set(items.flatMap((i) => i.foodTags))).sort(),
    [items],
  )

  const availableLocations = useMemo<LocationKey[]>(
    () =>
      LOCATION_ORDER.filter((loc) =>
        items.some((i) => (i.location ?? 'pantry') === loc),
      ),
    [items],
  )

  const filteredItems = useMemo(
    () => applyFilters(items, activeFilters),
    [items, activeFilters],
  )

  const rows = useMemo<PantryRow[]>(() => {
    const result: PantryRow[] = []
    for (const loc of LOCATION_ORDER) {
      const group = filteredItems.filter(
        (i) => (i.location ?? 'pantry') === loc,
      )
      if (!group.length) continue
      result.push({ type: 'header', loc, count: group.length })
      for (const item of group) result.push({ type: 'item', data: item })
    }
    return result
  }, [filteredItems])

  const activeFilterCount = useMemo(
    () =>
      (deferredQuery ? 1 : 0) +
      filters.locations.size +
      filters.statusFlags.size +
      filters.tags.size,
    [deferredQuery, filters],
  )

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name} from pantry?`)) return
    try {
      await deletePantryItem({ data: { id } })
      toast.success('Removed from pantry')
    } catch {
      toast.error('Failed to remove item')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Pantry</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen(true)}
          >
            Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </Button>
          <Button onClick={() => setScanOpen(true)} size="sm">
            + Scan
          </Button>
        </div>
      </div>

      <Input
        placeholder="Search pantry…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className="w-full"
      />

      {items.length === 0 && (
        <div className="text-center py-16 text-muted-foreground space-y-2">
          <p className="text-lg">Your pantry is empty</p>
          <p className="text-sm">
            Tap <strong>+ Scan</strong> to scan a barcode and add your first item.
          </p>
        </div>
      )}

      {items.length > 0 && filteredItems.length === 0 && (
        <div className="text-center py-12 text-muted-foreground space-y-2">
          <p>No items match your filters.</p>
          <button
            type="button"
            className="text-sm underline"
            onClick={() => {
              setFilters(emptyFilters())
              setSearchInput('')
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {rows.length > 0 && (
        <VirtualPantryList
          rows={rows}
          onItemClick={setInfoItem}
          onItemDelete={handleDelete}
        />
      )}

      <PantryFilters
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        value={filters}
        onChange={setFilters}
        onClearSearch={() => setSearchInput('')}
        availableTags={availableTags}
        availableLocations={availableLocations}
      />

      <BulkScanSheet open={scanOpen} onOpenChange={setScanOpen} />

      <Sheet
        open={infoItem !== null}
        onOpenChange={(o) => {
          if (!o) setInfoItem(null)
        }}
      >
        <SheetContent side="bottom" className="inset-x-2 bottom-2 rounded-xl pb-8">
          <SheetHeader>
            <div className="flex items-center gap-3">
              {infoItem?.foodImageUrl && (
                <img
                  src={infoItem.foodImageUrl}
                  alt=""
                  className="h-10 w-10 object-contain rounded flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <SheetTitle className="truncate">{infoItem?.foodName}</SheetTitle>
                {infoItem?.foodBrand && (
                  <p className="text-xs text-muted-foreground truncate">
                    {infoItem.foodBrand}
                  </p>
                )}
              </div>
            </div>
          </SheetHeader>
          <div className="mt-4 px-4">
            <FoodInfoPanel
              key={infoItem?.foodId ?? ''}
              barcode={infoItem?.foodBarcode}
              nutrition={infoItem?.foodNutritionPer100g}
              foodId={infoItem?.foodId}
              tags={infoItem?.foodTags}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
