import { cn } from '#/lib/utils'
import { Badge } from '#/components/ui/badge'
import type { NutritionPer100g } from '#/db/schema'
import FoodTagsEditor from '#/components/pantry/FoodTagsEditor'
import { formatQuantity } from '#/lib/units'

type Props = {
  barcode?: string | null
  nutrition?: NutritionPer100g | null
  className?: string
  foodId?: string
  tags?: string[]
  onTagsChange?: (next: string[]) => void
}

export default function FoodInfoPanel({ barcode, nutrition, className, foodId, tags, onTagsChange }: Props) {
  const hasNutrition =
    nutrition != null &&
    Object.keys(nutrition).length > 0
  const hasContent = barcode || hasNutrition || !!foodId || (tags !== undefined && !!onTagsChange)

  if (!hasContent) {
    return (
      <div className={cn('text-xs text-muted-foreground', className)}>
        No info available
      </div>
    )
  }

  // Caloric contributions for macro bar — computed unconditionally so percentages are stable
  const pKcal = nutrition != null ? (nutrition.protein ?? 0) * 4 : 0
  const cKcal = nutrition != null ? (nutrition.carbs ?? 0) * 4 : 0
  const fKcal = nutrition != null ? (nutrition.fat ?? 0) * 9 : 0
  const macroTotal = pKcal + cKcal + fKcal
  const hasMacroBar = macroTotal > 0

  const pPct = hasMacroBar ? Math.round((pKcal / macroTotal) * 100) : 0
  const fPct = hasMacroBar ? Math.round((fKcal / macroTotal) * 100) : 0
  const cPct = hasMacroBar ? 100 - pPct - fPct : 0

  const auxBadges: string[] = []
  if (nutrition != null) {
    if (nutrition.sugar !== undefined) auxBadges.push(`${formatQuantity(nutrition.sugar)}g sugar`)
    if (nutrition.fiber !== undefined) auxBadges.push(`${formatQuantity(nutrition.fiber)}g fiber`)
    if (nutrition.salt !== undefined) auxBadges.push(`${formatQuantity(nutrition.salt)}g salt`)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {tags && (foodId || onTagsChange) && (
        <div className="mb-3">
          {foodId
            ? <FoodTagsEditor foodId={foodId} tags={tags} />
            : <FoodTagsEditor mode="controlled" tags={tags} onChange={onTagsChange!} />}
        </div>
      )}

      {barcode && (
        <p className="font-mono text-xs text-muted-foreground">{barcode}</p>
      )}

      {nutrition != null && hasNutrition && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Per 100g
          </p>

          {nutrition.kcal !== undefined && (
            <p className="text-base font-semibold leading-none">
              {formatQuantity(nutrition.kcal)}{' '}
              <span className="text-xs font-normal text-muted-foreground">kcal</span>
            </p>
          )}

          {hasMacroBar && (
            <div className="space-y-1">
              <div className="flex h-2 overflow-hidden rounded-full">
                {pPct > 0 && (
                  <div className="bg-emerald-500" style={{ flexBasis: `${pPct}%` }} />
                )}
                {cPct > 0 && (
                  <div className="bg-amber-400" style={{ flexBasis: `${cPct}%` }} />
                )}
                {fPct > 0 && (
                  <div className="bg-rose-500" style={{ flexBasis: `${fPct}%` }} />
                )}
              </div>
              <div className="flex gap-3 text-[10px]">
                {pKcal > 0 && (
                  <span>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 align-middle" />
                    P {formatQuantity(nutrition.protein ?? 0)}g <span className="text-muted-foreground">{pPct}%</span>
                  </span>
                )}
                {cKcal > 0 && (
                  <span>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 mr-1 align-middle" />
                    C {formatQuantity(nutrition.carbs ?? 0)}g <span className="text-muted-foreground">{cPct}%</span>
                  </span>
                )}
                {fKcal > 0 && (
                  <span>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-rose-500 mr-1 align-middle" />
                    F {formatQuantity(nutrition.fat ?? 0)}g <span className="text-muted-foreground">{fPct}%</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {auxBadges.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {auxBadges.map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
