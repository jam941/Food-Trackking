import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '#/components/ui/dialog'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '#/components/ui/command'
import { searchFoods, setFoodUnpack } from '#/server/functions/food'
import type { Food } from '#/db/schema'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  foodId: string
  foodName: string
  onSaved: (unpacksToFoodId: string, unpackCount: number) => void
}

export default function UnpackConfigDialog({
  open,
  onOpenChange,
  foodId,
  foodName,
  onSaved,
}: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Food[]>([])
  const [selected, setSelected] = useState<Food | null>(null)
  const [count, setCount] = useState('1')
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)

  // Debounced search
  useEffect(() => {
    if (query.trim() === '') {
      setResults([])
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      searchFoods({ data: { query: query.trim() } })
        .then((res) => { if (!cancelled) setResults(res) })
        .catch(() => { if (!cancelled) setResults([]) })
        .finally(() => { if (!cancelled) setSearching(false) })
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query])

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery('')
      setResults([])
      setSelected(null)
      setCount('1')
      setLoading(false)
      setSearching(false)
    }
  }, [open])

  const parsedCount = Number(count)
  const canSave =
    selected !== null &&
    Number.isInteger(parsedCount) &&
    parsedCount >= 1

  async function handleSave() {
    if (!selected || !canSave) return
    setLoading(true)
    try {
      await setFoodUnpack({
        data: {
          foodId,
          unpacksToFoodId: selected.id,
          unpackCount: parsedCount,
        },
      })
      toast.success('Unpack mapping saved')
      onSaved(selected.id, parsedCount)
      onOpenChange(false)
    } catch {
      toast.error('Failed to save mapping')
    } finally {
      setLoading(false)
    }
  }

  const countLabel = selected
    ? `Contains × ${parsedCount || '?'} of ${selected.name}`
    : 'Pack count'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Configure unpack for {foodName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Search for atomic food</Label>
            <Command className="rounded-md border" shouldFilter={false}>
              <CommandInput
                placeholder="e.g. Coke Zero can"
                value={query}
                onValueChange={setQuery}
              />
              <CommandList>
                {query.trim() === '' ? null : searching ? (
                  <CommandEmpty>Searching…</CommandEmpty>
                ) : results.length === 0 ? (
                  <CommandEmpty>No foods found.</CommandEmpty>
                ) : (
                  <CommandGroup>
                    {results.map((item) => {
                      const isSelf = item.id === foodId
                      return (
                        <CommandItem
                          key={item.id}
                          value={item.id}
                          disabled={isSelf}
                          onSelect={() => {
                            if (!isSelf) setSelected(item)
                          }}
                          className={isSelf ? 'opacity-40 cursor-not-allowed' : undefined}
                          data-disabled={isSelf ? 'true' : undefined}
                        >
                          <span className="font-medium">{item.name}</span>
                          {item.brand && (
                            <span className="ml-1 text-muted-foreground text-xs">
                              — {item.brand}
                            </span>
                          )}
                          {selected?.id === item.id && (
                            <span className="ml-auto text-xs text-primary">Selected</span>
                          )}
                        </CommandItem>
                      )
                    })}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
            {selected && (
              <p className="text-sm text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selected.name}</span>
                {selected.brand && ` (${selected.brand})`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pack-count">{countLabel}</Label>
            <Input
              id="pack-count"
              type="number"
              min={1}
              step={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              className="w-32"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave || loading}>
            {loading ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
