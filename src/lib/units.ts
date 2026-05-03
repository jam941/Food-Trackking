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

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

export function formatQuantity(n: number): string {
  if (!isFinite(n) || isNaN(n)) return String(n)
  const whole = Math.trunc(n)
  const frac = n - whole
  if (Math.abs(frac) < 0.001) return String(whole)
  const numer16 = Math.round(frac * 16)
  if (Math.abs(frac * 16 - numer16) < 0.005 && numer16 > 0 && numer16 < 16) {
    const d = gcd(numer16, 16)
    const num = numer16 / d
    const den = 16 / d
    return whole === 0 ? `${num}/${den}` : `${whole} ${num}/${den}`
  }
  return parseFloat(n.toFixed(2)).toString()
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
