import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { createBarcodeScanner } from '#/lib/scanner'
import { findOrPrepareFoodForBarcode } from '#/server/functions/food'
import { createFood } from '#/server/functions/food'
import { createPantryItem } from '#/server/functions/pantry'
import type { Food } from '#/db/schema'

type ScanState =
  | { phase: 'scanning' }
  | { phase: 'existing'; food: Food }
  | { phase: 'new'; draft: Record<string, unknown> }
  | { phase: 'unknown'; barcode: string }
  | { phase: 'confirm'; foodId: string; foodName: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded: () => void
}

export default function ScanSheet({ open, onOpenChange, onAdded }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stopScannerRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<ScanState>({ phase: 'scanning' })
  const [manualBarcode, setManualBarcode] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [loading, setLoading] = useState(false)

  const handleBarcode = useCallback(async (barcode: string) => {
    stopScannerRef.current?.()
    setLoading(true)
    try {
      const result = await findOrPrepareFoodForBarcode({ data: { barcode } })
      if (result.status === 'existing') {
        setState({ phase: 'existing', food: result.food })
      } else if (result.status === 'new') {
        setState({ phase: 'new', draft: result.draft as Record<string, unknown> })
      } else {
        setState({ phase: 'unknown', barcode })
      }
    } catch {
      toast.error('Barcode lookup failed')
      setState({ phase: 'scanning' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      stopScannerRef.current?.()
      setState({ phase: 'scanning' })
      setManualBarcode('')
      return
    }
    if (state.phase !== 'scanning' || !videoRef.current) return

    const stop = createBarcodeScanner(
      videoRef.current,
      (result) => { void handleBarcode(result.text) },
      (err) => { toast.error(`Camera error: ${err.message}`) },
    )
    stopScannerRef.current = stop
    return stop
  }, [open, state.phase, handleBarcode])

  async function handleAddToExisting(foodId: string) {
    setLoading(true)
    try {
      await createPantryItem({
        data: { foodId, quantity: parseFloat(quantity) || 1, unit: 'piece' },
      })
      toast.success('Added to pantry')
      onAdded()
      onOpenChange(false)
    } catch {
      toast.error('Failed to add item')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveAndAdd(draft: Record<string, unknown>) {
    setLoading(true)
    try {
      const newFood = await createFood({ data: draft as Parameters<typeof createFood>[0]['data'] })
      await createPantryItem({
        data: { foodId: newFood.id, quantity: parseFloat(quantity) || 1, unit: (draft.defaultUnit as string ?? 'piece') as Parameters<typeof createPantryItem>[0]['data']['unit'] },
      })
      toast.success('Saved to foods and added to pantry')
      onAdded()
      onOpenChange(false)
    } catch {
      toast.error('Failed to save food')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Scan barcode</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pt-2">
          {state.phase === 'scanning' && (
            <>
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {loading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <p className="text-white text-sm">Looking up…</p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual">Or enter barcode manually</Label>
                <div className="flex gap-2">
                  <Input
                    id="manual"
                    placeholder="e.g. 737628064502"
                    value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualBarcode.trim()) {
                        void handleBarcode(manualBarcode.trim())
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    disabled={!manualBarcode.trim() || loading}
                    onClick={() => void handleBarcode(manualBarcode.trim())}
                  >
                    Look up
                  </Button>
                </div>
              </div>
            </>
          )}

          {state.phase === 'existing' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {state.food.imageUrl && (
                  <img src={state.food.imageUrl} alt="" className="h-16 w-16 object-contain rounded" />
                )}
                <div>
                  <p className="font-medium">{state.food.name}</p>
                  {state.food.brand && <p className="text-sm text-muted-foreground">{state.food.brand}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">Already in your food catalog</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Quantity to add to pantry</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={loading}
                  onClick={() => void handleAddToExisting(state.food.id)}
                >
                  Add to pantry
                </Button>
                <Button variant="outline" onClick={() => setState({ phase: 'scanning' })}>
                  Re-scan
                </Button>
              </div>
            </div>
          )}

          {state.phase === 'new' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {(state.draft.imageUrl as string) && (
                  <img src={state.draft.imageUrl as string} alt="" className="h-16 w-16 object-contain rounded" />
                )}
                <div>
                  <p className="font-medium">{(state.draft.name as string) || 'Unknown product'}</p>
                  {(state.draft.brand as string) && (
                    <p className="text-sm text-muted-foreground">{state.draft.brand as string}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">Found on Open Food Facts</p>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Quantity to add to pantry</Label>
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={loading}
                  onClick={() => void handleSaveAndAdd(state.draft)}
                >
                  Save & add to pantry
                </Button>
                <Button variant="outline" onClick={() => setState({ phase: 'scanning' })}>
                  Re-scan
                </Button>
              </div>
            </div>
          )}

          {state.phase === 'unknown' && (
            <div className="space-y-3">
              <p className="text-sm">
                Barcode <code className="bg-muted px-1 rounded">{state.barcode}</code> wasn't found in Open Food Facts.
              </p>
              <p className="text-sm text-muted-foreground">
                You can add this food manually with the barcode pre-filled.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setState({ phase: 'scanning' })}>
                  Re-scan
                </Button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
