import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select'
import { createBarcodeScanner } from '#/lib/scanner'
import { UNITS, UNIT_LABELS } from '#/lib/units'
import type { Unit } from '#/lib/units'
import { findOrPrepareFoodForBarcode } from '#/server/functions/food'
import { commitBulkAdd } from '#/server/functions/pantry'
import { queryClient } from '#/integrations/tanstack-query/root-provider'
import type { Food, NutritionPer100g } from '#/db/schema'
import UnpackConfigDialog from './UnpackConfigDialog'
import FoodInfoPanel from './FoodInfoPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

type DraftRow = {
  key: string
  source: 'off-existing' | 'off-new' | 'manual'
  foodId: string | null
  newFoodDraft?: {
    name: string
    brand?: string
    barcode?: string
    defaultUnit: Unit
    imageUrl?: string
    nutritionPer100g?: Record<string, number>
    externalSource?: string
    externalRef?: string
  }
  unpack: boolean
  food: {
    name: string
    brand?: string
    imageUrl?: string
    defaultUnit: Unit
    barcode?: string
    nutritionPer100g?: NutritionPer100g
    unpacksToFoodId?: string | null
    unpackCount?: number | null
  }
  quantity: number
  unit: Unit
  location: 'pantry' | 'fridge' | 'freezer' | 'other'
  expiresAt?: string
  noMerge: boolean
}

type PreviewData = {
  name: string
  brand?: string
  imageUrl?: string
  kcal?: number
  defaultUnit: Unit
}

type SheetState = {
  rows: DraftRow[]
  previewData: PreviewData | null
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SCAN_RESOLVED_EXISTING'; key: string; food: Food }
  | {
      type: 'SCAN_RESOLVED_NEW'
      key: string
      draft: {
        name: string
        brand?: string
        barcode?: string
        defaultUnit: string
        imageUrl?: string
        nutritionPer100g?: Record<string, number>
        externalSource?: string
        externalRef?: string
      }
    }
  | { type: 'ADD_MANUAL_ROW'; key: string; name: string; brand?: string; barcode: string; defaultUnit: Unit }
  | { type: 'SET_PREVIEW'; data: PreviewData | null }
  | { type: 'EDIT_QTY'; key: string; quantity: number }
  | { type: 'EDIT_UNIT'; key: string; unit: Unit }
  | { type: 'EDIT_LOCATION'; key: string; location: string }
  | { type: 'EDIT_EXPIRY'; key: string; expiresAt: string | undefined }
  | { type: 'TOGGLE_UNPACK'; key: string }
  | { type: 'UPDATE_UNPACK_CONFIG'; foodId: string; unpacksToFoodId: string; unpackCount: number }
  | { type: 'SPLIT_ROW'; key: string }
  | { type: 'REMOVE_ROW'; key: string }
  | { type: 'CLEAR' }

// ─── Reducer ──────────────────────────────────────────────────────────────────

const initialState: SheetState = { rows: [], previewData: null }

function reducer(state: SheetState, action: Action): SheetState {
  switch (action.type) {
    case 'SCAN_RESOLVED_EXISTING': {
      const food = action.food
      const existingIdx = state.rows.findIndex(
        (r) => r.foodId === food.id && !r.noMerge,
      )
      if (existingIdx !== -1) {
        const rows = state.rows.map((r, i) =>
          i === existingIdx ? { ...r, quantity: r.quantity + 1 } : r,
        )
        return { ...state, rows }
      }
      const newRow: DraftRow = {
        key: action.key,
        source: 'off-existing',
        foodId: food.id,
        unpack: false,
        food: {
          name: food.name,
          brand: food.brand ?? undefined,
          imageUrl: food.imageUrl ?? undefined,
          defaultUnit: food.defaultUnit,
          barcode: food.barcode ?? undefined,
          nutritionPer100g: food.nutritionPer100g ?? undefined,
          unpacksToFoodId: food.unpacksToFoodId,
          unpackCount: food.unpackCount,
        },
        quantity: 1,
        unit: food.defaultUnit,
        location: 'pantry',
        noMerge: false,
      }
      return { ...state, rows: [...state.rows, newRow] }
    }

    case 'SCAN_RESOLVED_NEW': {
      const { draft } = action
      const existingIdx = state.rows.findIndex(
        (r) =>
          r.source === 'off-new' &&
          r.newFoodDraft?.barcode === draft.barcode &&
          !r.noMerge,
      )
      if (existingIdx !== -1) {
        const rows = state.rows.map((r, i) =>
          i === existingIdx ? { ...r, quantity: r.quantity + 1 } : r,
        )
        return { ...state, rows }
      }
      const defaultUnit = draft.defaultUnit as Unit
      const newRow: DraftRow = {
        key: action.key,
        source: 'off-new',
        foodId: null,
        newFoodDraft: {
          name: draft.name,
          brand: draft.brand,
          barcode: draft.barcode,
          defaultUnit,
          imageUrl: draft.imageUrl,
          nutritionPer100g: draft.nutritionPer100g,
          externalSource: draft.externalSource,
          externalRef: draft.externalRef,
        },
        unpack: false,
        food: {
          name: draft.name,
          brand: draft.brand,
          imageUrl: draft.imageUrl,
          defaultUnit,
          barcode: draft.barcode,
          nutritionPer100g: draft.nutritionPer100g,
        },
        quantity: 1,
        unit: defaultUnit,
        location: 'pantry',
        noMerge: false,
      }
      return { ...state, rows: [...state.rows, newRow] }
    }

    case 'ADD_MANUAL_ROW': {
      const newRow: DraftRow = {
        key: action.key,
        source: 'manual',
        foodId: null,
        newFoodDraft: {
          name: action.name,
          brand: action.brand,
          barcode: action.barcode,
          defaultUnit: action.defaultUnit,
        },
        unpack: false,
        food: {
          name: action.name,
          brand: action.brand,
          defaultUnit: action.defaultUnit,
        },
        quantity: 1,
        unit: action.defaultUnit,
        location: 'pantry',
        noMerge: false,
      }
      return { ...state, rows: [...state.rows, newRow] }
    }

    case 'SET_PREVIEW':
      return { ...state, previewData: action.data }

    case 'EDIT_QTY':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key ? { ...r, quantity: action.quantity } : r,
        ),
      }

    case 'EDIT_UNIT':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key ? { ...r, unit: action.unit } : r,
        ),
      }

    case 'EDIT_LOCATION':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key
            ? { ...r, location: action.location as DraftRow['location'] }
            : r,
        ),
      }

    case 'EDIT_EXPIRY':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key ? { ...r, expiresAt: action.expiresAt } : r,
        ),
      }

    case 'TOGGLE_UNPACK':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key ? { ...r, unpack: !r.unpack } : r,
        ),
      }

    case 'UPDATE_UNPACK_CONFIG':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.foodId === action.foodId
            ? {
                ...r,
                food: {
                  ...r.food,
                  unpacksToFoodId: action.unpacksToFoodId,
                  unpackCount: action.unpackCount,
                },
              }
            : r,
        ),
      }

    case 'SPLIT_ROW':
      return {
        ...state,
        rows: state.rows.map((r) =>
          r.key === action.key ? { ...r, noMerge: true } : r,
        ),
      }

    case 'REMOVE_ROW':
      return { ...state, rows: state.rows.filter((r) => r.key !== action.key) }

    case 'CLEAR':
      return initialState

    default:
      return state
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BulkScanSheet({ open, onOpenChange }: Props) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [manualEntryBarcode, setManualEntryBarcode] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [unpackDialogKey, setUnpackDialogKey] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Manual barcode input (always visible below camera)
  const [manualInputValue, setManualInputValue] = useState('')

  // Manual entry form state
  const [manualName, setManualName] = useState('')
  const [manualBrand, setManualBrand] = useState('')
  const [manualUnit, setManualUnit] = useState<Unit>('piece')

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const stopScannerRef = useRef<(() => void) | null>(null)
  const lastBarcodeAtRef = useRef<Map<string, number>>(new Map())
  const scanQueueRef = useRef<string[]>([])
  const processingRef = useRef<boolean>(false)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualEntryActiveRef = useRef(false)
  const sessionRef = useRef(0)

  // ─── showPreview ───────────────────────────────────────────────────────────

  const showPreview = useCallback((data: PreviewData) => {
    dispatch({ type: 'SET_PREVIEW', data })
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
    previewTimerRef.current = setTimeout(() => {
      dispatch({ type: 'SET_PREVIEW', data: null })
    }, 2000)
  }, [])

  // ─── processNextInQueue ────────────────────────────────────────────────────

  const processNextInQueue = useCallback(async () => {
    if (processingRef.current || manualEntryActiveRef.current || scanQueueRef.current.length === 0) return
    processingRef.current = true
    const barcode = scanQueueRef.current.shift()!
    const sessionAtStart = sessionRef.current
    try {
      const result = await findOrPrepareFoodForBarcode({ data: { barcode } })
      if (sessionRef.current !== sessionAtStart) return
      if (result.status === 'existing') {
        dispatch({ type: 'SCAN_RESOLVED_EXISTING', key: crypto.randomUUID(), food: result.food })
        showPreview({
          name: result.food.name,
          brand: result.food.brand ?? undefined,
          imageUrl: result.food.imageUrl ?? undefined,
          kcal: result.food.nutritionPer100g?.kcal,
          defaultUnit: result.food.defaultUnit,
        })
      } else if (result.status === 'new') {
        const draft = result.draft as {
          name: string
          brand?: string
          barcode?: string
          defaultUnit: string
          imageUrl?: string
          nutritionPer100g?: Record<string, number>
          externalSource?: string
          externalRef?: string
        }
        dispatch({ type: 'SCAN_RESOLVED_NEW', key: crypto.randomUUID(), draft })
        showPreview({
          name: draft.name,
          brand: draft.brand,
          imageUrl: draft.imageUrl,
          kcal: draft.nutritionPer100g?.kcal,
          defaultUnit: draft.defaultUnit as Unit,
        })
      } else {
        // unknown — show manual entry form
        if (sessionRef.current !== sessionAtStart) return
        scanQueueRef.current = []
        manualEntryActiveRef.current = true
        setManualEntryBarcode(barcode)
        stopScannerRef.current?.()
      }
    } catch {
      toast.error('Barcode lookup failed')
    } finally {
      processingRef.current = false
      if (!manualEntryActiveRef.current) void processNextInQueueRef.current()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPreview])

  const processNextInQueueRef = useRef(processNextInQueue)
  useEffect(() => { processNextInQueueRef.current = processNextInQueue }, [processNextInQueue])

  // ─── Camera effect ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || manualEntryBarcode !== null) {
      stopScannerRef.current?.()
      if (!open) {
        sessionRef.current++
        dispatch({ type: 'CLEAR' })
        setManualEntryBarcode(null)
        manualEntryActiveRef.current = false
        setCommitting(false)
        setManualInputValue('')
        setManualName('')
        setManualBrand('')
        setManualUnit('piece')
        scanQueueRef.current = []
        processingRef.current = false
        lastBarcodeAtRef.current.clear()
        if (previewTimerRef.current) {
          clearTimeout(previewTimerRef.current)
          previewTimerRef.current = null
        }
      }
      return
    }
    if (!videoRef.current) return
    const stop = createBarcodeScanner(
      videoRef.current,
      (result) => {
        const barcode = result.text
        const now = Date.now()
        const last = lastBarcodeAtRef.current.get(barcode) ?? 0
        if (now - last < 2000) return
        lastBarcodeAtRef.current.set(barcode, now)
        scanQueueRef.current.push(barcode)
        void processNextInQueue()
      },
      (err) => toast.error(`Camera error: ${err.message}`),
    )
    stopScannerRef.current = stop
    return stop
  }, [open, manualEntryBarcode, processNextInQueue])

  // ─── Manual barcode lookup (always-visible input row) ─────────────────────

  function handleManualLookup() {
    const barcode = manualInputValue.trim()
    if (!barcode) return
    setManualInputValue('')
    const now = Date.now()
    lastBarcodeAtRef.current.set(barcode, now)
    scanQueueRef.current.push(barcode)
    void processNextInQueue()
  }

  // ─── Manual entry form submit ─────────────────────────────────────────────

  function handleManualEntrySubmit() {
    if (!manualName.trim() || !manualEntryBarcode) return
    dispatch({
      type: 'ADD_MANUAL_ROW',
      key: crypto.randomUUID(),
      name: manualName.trim(),
      brand: manualBrand.trim() || undefined,
      barcode: manualEntryBarcode,
      defaultUnit: manualUnit,
    })
    setManualName('')
    setManualBrand('')
    setManualUnit('piece')
    manualEntryActiveRef.current = false
    setManualEntryBarcode(null)
  }

  function handleManualEntrySkip() {
    setManualName('')
    setManualBrand('')
    setManualUnit('piece')
    manualEntryActiveRef.current = false
    setManualEntryBarcode(null)
  }

  // ─── Commit ────────────────────────────────────────────────────────────────

  async function handleCommit() {
    setCommitting(true)
    try {
      const items = state.rows.map((row) => ({
        foodId: row.foodId,
        newFood: row.source !== 'off-existing' ? row.newFoodDraft : undefined,
        unpack: row.unpack,
        quantity: row.quantity,
        unit: row.unit,
        location: row.location,
        expiresAt: row.expiresAt,
        noMerge: row.noMerge,
        _rowKey: row.key,
      }))
      await commitBulkAdd({ data: { items } })
      queryClient.invalidateQueries({ queryKey: ['pantry'] })
      toast.success(
        `Added ${state.rows.length} item${state.rows.length !== 1 ? 's' : ''} to pantry`,
      )
      onOpenChange(false)
    } catch {
      toast.error('Failed to add items')
    } finally {
      setCommitting(false)
    }
  }

  // ─── Derived values ────────────────────────────────────────────────────────

  const totalQty = state.rows.reduce((sum, r) => sum + r.quantity, 0)

  // The row whose UnpackConfigDialog is open
  const unpackDialogRow = unpackDialogKey
    ? state.rows.find((r) => r.key === unpackDialogKey) ?? null
    : null

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>Bulk add</SheetTitle>
        </SheetHeader>

        {/* ── Camera area ── */}
        <div className="relative bg-black rounded-lg overflow-hidden" style={{ height: '30vh' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Preview card */}
          {state.previewData && (
            <div className="absolute bottom-2 left-2 right-2 bg-black/80 text-white rounded-lg p-2 flex gap-2 items-start">
              {state.previewData.imageUrl && (
                <img
                  src={state.previewData.imageUrl}
                  alt=""
                  className="h-10 w-10 object-contain rounded flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{state.previewData.name}</p>
                {state.previewData.brand && (
                  <p className="text-xs opacity-70 truncate">{state.previewData.brand}</p>
                )}
                <p className="text-xs opacity-60">
                  {UNIT_LABELS[state.previewData.defaultUnit]}
                  {state.previewData.kcal != null ? ` · ${state.previewData.kcal} kcal` : ''}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Manual entry form (inline, shown when unknown barcode) ── */}
        {manualEntryBarcode !== null && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            <p className="text-sm">
              Barcode <code className="bg-muted px-1 rounded">{manualEntryBarcode}</code> wasn't
              found. Enter details manually:
            </p>
            <div className="space-y-2">
              <div className="space-y-1">
                <Label htmlFor="manual-name">Name *</Label>
                <Input
                  id="manual-name"
                  placeholder="Product name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="manual-brand">Brand (optional)</Label>
                <Input
                  id="manual-brand"
                  placeholder="Brand"
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Default unit</Label>
                <Select
                  value={manualUnit}
                  onValueChange={(v) => setManualUnit(v as Unit)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!manualName.trim()}
                onClick={handleManualEntrySubmit}
              >
                Add to list
              </Button>
              <Button size="sm" variant="outline" onClick={handleManualEntrySkip}>
                Skip
              </Button>
            </div>
          </div>
        )}

        {/* ── Manual barcode input row (always visible) ── */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter barcode manually"
            value={manualInputValue}
            onChange={(e) => setManualInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && manualInputValue.trim()) handleManualLookup()
            }}
          />
          <Button
            variant="outline"
            disabled={!manualInputValue.trim()}
            onClick={handleManualLookup}
          >
            Look up
          </Button>
        </div>

        {/* ── Draft list ── */}
        <div className="flex-1 overflow-y-auto">
          {state.rows.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Scan barcodes to add items
            </p>
          )}
          {state.rows.map((row) => (
            <div key={row.key} className="border rounded-lg p-2 mb-2">
              {/* Top row: image, name, brand, expand toggle, remove */}
              <div
                className={`flex items-center gap-2 mb-2 ${row.source !== 'manual' ? 'cursor-pointer select-none' : ''}`}
                onClick={() => {
                  if (row.source !== 'manual') {
                    setExpandedKey(expandedKey === row.key ? null : row.key)
                  }
                }}
              >
                {row.food.imageUrl && (
                  <img
                    src={row.food.imageUrl}
                    alt=""
                    className="h-8 w-8 object-contain rounded flex-shrink-0"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">{row.food.name}</p>
                  {row.food.brand && (
                    <p className="text-xs text-muted-foreground truncate">{row.food.brand}</p>
                  )}
                </div>
                {row.source !== 'manual' && (
                  <span className="text-muted-foreground text-xs flex-shrink-0">
                    {expandedKey === row.key ? '▾' : '▸'}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 flex-shrink-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    dispatch({ type: 'REMOVE_ROW', key: row.key })
                  }}
                >
                  ✕
                </Button>
              </div>

              {/* Bottom row: qty, unit, location, unpack, split */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Quantity stepper */}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    dispatch({
                      type: 'EDIT_QTY',
                      key: row.key,
                      quantity: Math.max(1, row.quantity - 1),
                    })
                  }
                >
                  −
                </Button>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={row.quantity}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value)
                    if (v > 0) dispatch({ type: 'EDIT_QTY', key: row.key, quantity: v })
                  }}
                  className="w-16 h-7 text-center px-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() =>
                    dispatch({ type: 'EDIT_QTY', key: row.key, quantity: row.quantity + 1 })
                  }
                >
                  +
                </Button>

                {/* Unit select */}
                <Select
                  value={row.unit}
                  onValueChange={(v) =>
                    dispatch({ type: 'EDIT_UNIT', key: row.key, unit: v as Unit })
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[4rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u} className="text-xs">
                        {UNIT_LABELS[u]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Location select */}
                <Select
                  value={row.location}
                  onValueChange={(v) =>
                    dispatch({ type: 'EDIT_LOCATION', key: row.key, location: v })
                  }
                >
                  <SelectTrigger className="h-7 text-xs w-auto min-w-[4.5rem]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pantry" className="text-xs">Pantry</SelectItem>
                    <SelectItem value="fridge" className="text-xs">Fridge</SelectItem>
                    <SelectItem value="freezer" className="text-xs">Freezer</SelectItem>
                    <SelectItem value="other" className="text-xs">Other</SelectItem>
                  </SelectContent>
                </Select>

                {/* Expiry date input */}
                <Input
                  type="date"
                  className="h-7 text-xs w-32"
                  value={row.expiresAt?.split('T')[0] ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'EDIT_EXPIRY',
                      key: row.key,
                      expiresAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : undefined,
                    })
                  }
                />

                {/* Unpack toggle — existing food with unpack mapping already set */}
                {row.food.unpacksToFoodId != null && (
                    <Button
                      size="sm"
                      variant={row.unpack ? 'default' : 'outline'}
                      className="h-7 text-xs px-2"
                      onClick={() => dispatch({ type: 'TOGGLE_UNPACK', key: row.key })}
                    >
                      Unpack ({row.food.unpackCount}×)
                    </Button>
                  )}

                {/* Unpack config button — existing food with no mapping yet */}
                {row.source === 'off-existing' &&
                  row.food.unpacksToFoodId == null && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={() => setUnpackDialogKey(row.key)}
                    >
                      Unpack…
                    </Button>
                  )}

                {/* Split button */}
                {!row.noMerge && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => dispatch({ type: 'SPLIT_ROW', key: row.key })}
                    title="Split into separate row (won't merge on next scan)"
                  >
                    Split
                  </Button>
                )}
              </div>

              {/* Info sub-panel */}
              {expandedKey === row.key && row.source !== 'manual' && (
                <FoodInfoPanel
                  className="mt-2 pt-2 border-t"
                  barcode={row.food.barcode}
                  nutrition={row.food.nutritionPer100g}
                />
              )}
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <div className="border-t pt-2 pb-4 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {state.rows.length} item{state.rows.length !== 1 ? 's' : ''},{' '}
            {totalQty} unit{totalQty !== 1 ? 's' : ''}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={state.rows.length === 0 || committing}
              onClick={() => void handleCommit()}
            >
              {committing ? 'Adding…' : `Add all (${state.rows.length})`}
            </Button>
          </div>
        </div>

        {/* ── UnpackConfigDialog ── */}
        {unpackDialogRow?.source === 'off-existing' && unpackDialogRow.foodId !== null && (
          <UnpackConfigDialog
            open={unpackDialogKey !== null}
            onOpenChange={(o) => { if (!o) setUnpackDialogKey(null) }}
            foodId={unpackDialogRow.foodId}
            foodName={unpackDialogRow.food.name}
            onSaved={(unpacksToFoodId, unpackCount) => {
              if (unpackDialogRow.foodId) {
                dispatch({
                  type: 'UPDATE_UNPACK_CONFIG',
                  foodId: unpackDialogRow.foodId,
                  unpacksToFoodId,
                  unpackCount,
                })
              }
              setUnpackDialogKey(null)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}
