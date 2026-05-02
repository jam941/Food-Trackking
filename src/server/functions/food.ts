import { and, eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '#/db'
import { food, type NewFood } from '#/db/schema'
import { lookupBarcode } from '#/server/off'
import { requireSession } from '#/server/session'
import { UNITS } from '#/lib/units'

const UnitSchema = z.enum(UNITS)

export const CreateFoodSchema = z.object({
  name: z.string().min(1),
  brand: z.string().optional(),
  barcode: z.string().optional(),
  defaultUnit: UnitSchema.default('g'),
  category: z.string().optional(),
  imageUrl: z.string().url().optional(),
  nutritionPer100g: z
    .object({
      kcal: z.number().optional(),
      protein: z.number().optional(),
      carbs: z.number().optional(),
      fat: z.number().optional(),
      sugar: z.number().optional(),
      salt: z.number().optional(),
      fiber: z.number().optional(),
    })
    .optional(),
  externalSource: z.string().optional(),
  externalRef: z.string().optional(),
})

export const listFoods = createServerFn().handler(async () => {
  const session = await requireSession()
  return db.select().from(food).where(eq(food.userId, session.user.id))
})

export const createFood = createServerFn({ method: 'POST' })
  .inputValidator(CreateFoodSchema)
  .handler(async ({ data }) => {
    const session = await requireSession()
    const [item] = await db
      .insert(food)
      .values({ ...(data as NewFood), userId: session.user.id })
      .returning()
    return item
  })

export const updateFood = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), data: CreateFoodSchema.partial() }))
  .handler(async ({ data: { id, data: patch } }) => {
    const session = await requireSession()
    const [item] = await db
      .update(food)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(food.id, id), eq(food.userId, session.user.id)))
      .returning()
    return item
  })

export const deleteFood = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const session = await requireSession()
    await db
      .delete(food)
      .where(and(eq(food.id, id), eq(food.userId, session.user.id)))
  })

/**
 * Cross-references a barcode against:
 *  1. The user's saved foods (existing → skip creation)
 *  2. Open Food Facts cache/API (new → prefilled draft)
 *  3. Unknown barcode → empty draft with barcode prefilled
 */
export const findOrPrepareFoodForBarcode = createServerFn()
  .inputValidator(z.object({ barcode: z.string() }))
  .handler(async ({ data: { barcode } }) => {
    const session = await requireSession()

    const existing = await db
      .select()
      .from(food)
      .where(and(eq(food.userId, session.user.id), eq(food.barcode, barcode)))
      .limit(1)

    if (existing.length > 0) {
      return { status: 'existing' as const, food: existing[0] }
    }

    const offProduct = await lookupBarcode(barcode)

    if (offProduct) {
      return {
        status: 'new' as const,
        draft: {
          name: offProduct.name,
          brand: offProduct.brand,
          barcode,
          defaultUnit: offProduct.defaultUnit,
          imageUrl: offProduct.imageUrl,
          nutritionPer100g: offProduct.nutritionPer100g,
          externalSource: 'open_food_facts',
          externalRef: barcode,
        },
      }
    }

    return { status: 'unknown' as const, draft: { barcode } }
  })
