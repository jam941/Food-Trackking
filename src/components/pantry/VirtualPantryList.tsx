import { useRef } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import type { PantryItemWithFood } from '#/server/functions/pantry'
import type { LocationKey } from '#/lib/pantry-filters'
import { UNIT_LABELS } from '#/lib/units'
import type { Unit } from '#/lib/units'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'

export type { LocationKey }

export type PantryRow =
  | { type: 'header'; loc: LocationKey; count: number }
  | { type: 'item'; data: PantryItemWithFood }

type VirtualPantryListProps = {
  rows: PantryRow[]
  onItemClick: (item: PantryItemWithFood) => void
  onItemDelete: (id: string, name: string) => void
}

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

type ItemRowProps = {
  item: PantryItemWithFood
  onClick: () => void
  onDelete: () => void
}

function ItemRow({ item, onClick, onDelete }: ItemRowProps) {
  return (
    <button
      type="button"
      className="w-full text-left"
      onClick={onClick}
    >
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
            {item.quantity} {UNIT_LABELS[item.unit as Unit]}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expiryBadge(item.expiresAt)}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-destructive h-7 w-7 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            ✕
          </Button>
        </div>
      </div>
    </button>
  )
}

export function VirtualPantryList({
  rows,
  onItemClick,
  onItemDelete,
}: VirtualPantryListProps) {
  const listRef = useRef<HTMLDivElement>(null)

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (i) => (rows[i].type === 'header' ? 40 : 72),
    overscan: 6,
    getItemKey: (i) =>
      rows[i].type === 'header' ? `h:${rows[i].loc}` : rows[i].data.id,
    scrollMargin: listRef.current?.offsetTop ?? 0,
  })

  return (
    <div ref={listRef} style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
      {virtualizer.getVirtualItems().map((vItem) => {
        const row = rows[vItem.index]
        return (
          <div
            key={vItem.key as string}
            data-index={vItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${vItem.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {row.type === 'header' ? (
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2 mt-4 capitalize">
                {row.loc} ({row.count})
              </h2>
            ) : (
              <ItemRow
                item={row.data}
                onClick={() => onItemClick(row.data)}
                onDelete={() => onItemDelete(row.data.id, row.data.foodName)}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
