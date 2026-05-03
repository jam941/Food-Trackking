import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '#/components/ui/sheet'
import { ScrollArea } from '#/components/ui/scroll-area'
import { Separator } from '#/components/ui/separator'
import { Checkbox } from '#/components/ui/checkbox'
import { Label } from '#/components/ui/label'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import type { FilterState, LocationKey, StatusFlag } from '#/lib/pantry-filters'
import { emptyFilters } from '#/lib/pantry-filters'

type PantryFiltersProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: FilterState
  onChange: (next: FilterState) => void
  onClearSearch?: () => void
  availableTags: string[]
  availableLocations: LocationKey[]
}

function toggleSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

const STATUS_FLAGS: { flag: StatusFlag; label: string }[] = [
  { flag: 'has-exp', label: 'Has expiration' },
  { flag: 'expiring-soon', label: 'Expiring within 3 days' },
  { flag: 'expired', label: 'Expired' },
  { flag: 'opened', label: 'Opened' },
]

export function PantryFilters({
  open,
  onOpenChange,
  value,
  onChange,
  onClearSearch,
  availableTags,
  availableLocations,
}: PantryFiltersProps) {
  const [tagSearch, setTagSearch] = useState('')

  const visibleTags =
    availableTags.length > 12 && tagSearch.trim() !== ''
      ? availableTags.filter((t) =>
          t.toLowerCase().includes(tagSearch.toLowerCase()),
        )
      : availableTags

  function handleClearAll() {
    onChange(emptyFilters())
    onClearSearch?.()
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[80vh] flex flex-col pb-0">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-hidden px-4">
          {/* Section 1 — Location */}
          <div className="py-4">
            <p className="text-sm font-semibold mb-2">Location</p>
            {availableLocations.map((loc) => (
              <div key={loc} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={`loc-${loc}`}
                  checked={value.locations.has(loc)}
                  onCheckedChange={(checked) => {
                    if (checked === 'indeterminate') return
                    onChange({
                      ...value,
                      locations: toggleSet(value.locations, loc),
                    })
                  }}
                />
                <Label htmlFor={`loc-${loc}`} className="capitalize cursor-pointer">
                  {loc.charAt(0).toUpperCase() + loc.slice(1)}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Section 2 — Status */}
          <div className="py-4">
            <p className="text-sm font-semibold mb-2">Status</p>
            {STATUS_FLAGS.map(({ flag, label }) => (
              <div key={flag} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={`status-${flag}`}
                  checked={value.statusFlags.has(flag)}
                  onCheckedChange={(checked) => {
                    if (checked === 'indeterminate') return
                    onChange({
                      ...value,
                      statusFlags: toggleSet(value.statusFlags, flag),
                    })
                  }}
                />
                <Label htmlFor={`status-${flag}`} className="cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
          </div>

          <Separator />

          {/* Section 3 — Category */}
          <div className="py-4">
            <p className="text-sm font-semibold mb-2">Category</p>
            {availableTags.length > 12 && (
              <Input
                placeholder="Filter categories…"
                value={tagSearch}
                onChange={(e) => setTagSearch(e.target.value)}
                className="mb-3 h-8 text-sm"
              />
            )}
            {visibleTags.map((tag) => (
              <div key={tag} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={`tag-${tag}`}
                  checked={value.tags.has(tag)}
                  onCheckedChange={(checked) => {
                    if (checked === 'indeterminate') return
                    onChange({
                      ...value,
                      tags: toggleSet(value.tags, tag),
                    })
                  }}
                />
                <Label htmlFor={`tag-${tag}`} className="cursor-pointer">
                  {tag}
                </Label>
              </div>
            ))}
          </div>
        </ScrollArea>

        <SheetFooter className="sticky bottom-0 bg-background border-t px-4 py-3 flex flex-row gap-2">
          <Button variant="ghost" onClick={handleClearAll} className="flex-1">
            Clear all
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">
            Apply
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
