export const UNITS = [
  'g', 'kg', 'ml', 'l', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece', 'slice',
] as const

export type Unit = (typeof UNITS)[number]

export const UNIT_LABELS: Record<Unit, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'L',
  oz: 'oz',
  lb: 'lb',
  cup: 'cup',
  tbsp: 'tbsp',
  tsp: 'tsp',
  piece: 'pc',
  slice: 'slice',
}

export function guessUnitFromOFF(quantityStr: string | undefined): Unit {
  if (!quantityStr) return 'g'
  const lower = quantityStr.toLowerCase()
  if (lower.includes('ml') || lower.includes('cl') || lower.includes('fl oz')) return 'ml'
  if (lower.includes('kg')) return 'kg'
  if (/\d+\s*l\b/.test(lower)) return 'l'
  if (lower.includes('lb')) return 'lb'
  if (lower.includes('oz') && !lower.includes('fl')) return 'oz'
  if (lower.includes('cup')) return 'cup'
  return 'g'
}
