import { and, asc, eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '#/db'
import { food, pantryItem } from '#/db/schema'
import { requireSession } from '#/server/session'
import { UNITS } from '#/lib/units'

const UnitSchema = z.enum(UNITS)

export const CreatePantryItemSchema = z.object({
  foodId: z.string(),
  quantity: z.number().positive(),
  unit: UnitSchema,
  location: z.enum(['pantry', 'fridge', 'freezer', 'other']).optional(),
  expiresAt: z.string().datetime().optional(),
  note: z.string().optional(),
})

export type PantryItemWithFood = {
  id: string
  userId: string
  foodId: string
  quantity: number
  unit: string
  location: string | null
  expiresAt: Date | null
  openedAt: Date | null
  note: string | null
  createdAt: Date
  foodName: string
  foodBrand: string | null
  foodImageUrl: string | null
  foodBarcode: string | null
}

export const listPantry = createServerFn().handler(async () => {
  const session = await requireSession()
  const rows = await db
    .select({
      id: pantryItem.id,
      userId: pantryItem.userId,
      foodId: pantryItem.foodId,
      quantity: pantryItem.quantity,
      unit: pantryItem.unit,
      location: pantryItem.location,
      expiresAt: pantryItem.expiresAt,
      openedAt: pantryItem.openedAt,
      note: pantryItem.note,
      createdAt: pantryItem.createdAt,
      foodName: food.name,
      foodBrand: food.brand,
      foodImageUrl: food.imageUrl,
      foodBarcode: food.barcode,
    })
    .from(pantryItem)
    .innerJoin(food, eq(pantryItem.foodId, food.id))
    .where(eq(pantryItem.userId, session.user.id))
    .orderBy(asc(pantryItem.expiresAt))
  return rows
})

export const createPantryItem = createServerFn({ method: 'POST' })
  .inputValidator(CreatePantryItemSchema)
  .handler(async ({ data }) => {
    const session = await requireSession()
    const [item] = await db
      .insert(pantryItem)
      .values({
        ...data,
        userId: session.user.id,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      })
      .returning()
    return item
  })

export const updatePantryItem = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ id: z.string(), data: CreatePantryItemSchema.partial() }),
  )
  .handler(async ({ data: { id, data: patch } }) => {
    const session = await requireSession()
    const [item] = await db
      .update(pantryItem)
      .set({
        ...patch,
        expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : undefined,
      })
      .where(and(eq(pantryItem.id, id), eq(pantryItem.userId, session.user.id)))
      .returning()
    return item
  })

export const deletePantryItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const session = await requireSession()
    await db
      .delete(pantryItem)
      .where(
        and(eq(pantryItem.id, id), eq(pantryItem.userId, session.user.id)),
      )
  })
