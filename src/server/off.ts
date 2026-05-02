import { eq } from 'drizzle-orm'
import { db } from '#/db'
import { offProductCache, type OFFProductData } from '#/db/schema'
import { guessUnitFromOFF } from '#/lib/units'

const OFF_BASE = 'https://world.openfoodfacts.org/api/v2/product'
const OFF_FIELDS = [
  'product_name',
  'brands',
  'image_front_small_url',
  'quantity',
  'nutriments',
  'categories_tags',
  'code',
].join(',')

function normalizeOFFResponse(raw: Record<string, unknown>): OFFProductData {
  const nutriments = (raw.nutriments as Record<string, unknown>) ?? {}
  return {
    name: (raw.product_name as string) ?? '',
    brand: (raw.brands as string) ?? undefined,
    imageUrl: (raw.image_front_small_url as string) ?? undefined,
    quantity: (raw.quantity as string) ?? undefined,
    defaultUnit: guessUnitFromOFF(raw.quantity as string | undefined),
    nutritionPer100g: {
      kcal: (nutriments['energy-kcal_100g'] as number) ?? undefined,
      protein: (nutriments['proteins_100g'] as number) ?? undefined,
      carbs: (nutriments['carbohydrates_100g'] as number) ?? undefined,
      fat: (nutriments['fat_100g'] as number) ?? undefined,
      sugar: (nutriments['sugars_100g'] as number) ?? undefined,
      salt: (nutriments['salt_100g'] as number) ?? undefined,
      fiber: (nutriments['fiber_100g'] as number) ?? undefined,
    },
    categories: Array.isArray(raw.categories_tags)
      ? (raw.categories_tags as string[]).slice(0, 5)
      : undefined,
  }
}

export async function lookupBarcode(
  barcode: string,
): Promise<OFFProductData | null> {
  // Check cache first
  const cached = await db
    .select()
    .from(offProductCache)
    .where(eq(offProductCache.barcode, barcode))
    .limit(1)

  if (cached.length > 0) {
    return cached[0].data
  }

  // Fetch from Open Food Facts
  const userAgent = process.env.OFF_USER_AGENT ?? 'Food-Trackking/0.1'
  const url = `${OFF_BASE}/${barcode}?fields=${OFF_FIELDS}`

  let responseJson: Record<string, unknown>
  try {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent } })
    responseJson = (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }

  if (responseJson.status !== 1 || !responseJson.product) {
    return null
  }

  const product = normalizeOFFResponse(
    responseJson.product as Record<string, unknown>,
  )

  // Cache the result
  await db
    .insert(offProductCache)
    .values({ barcode, data: product })
    .onConflictDoUpdate({
      target: offProductCache.barcode,
      set: { data: product, fetchedAt: new Date() },
    })

  return product
}
