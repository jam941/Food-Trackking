import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '#/db'
import { food, pantryItem } from '#/db/schema'
import { requireSession } from '#/server/session'
import { UNITS } from '#/lib/units'
import { CreateFoodSchema } from './food'

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

const BulkAddItemSchema = z.object({
  foodId: z.string().nullable(),
  newFood: CreateFoodSchema.optional(),
  unpack: z.boolean(),
  quantity: z.number().positive(),
  unit: UnitSchema,
  location: z.enum(['pantry', 'fridge', 'freezer', 'other']),
  expiresAt: z.string().datetime().optional(),
  note: z.string().optional(),
  noMerge: z.boolean().default(false),
  _rowKey: z.string(),
}).refine(
  (data) => !(data.foodId !== null && data.newFood !== undefined),
  { message: 'Cannot specify both foodId and newFood' },
)

export const commitBulkAdd = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ items: z.array(BulkAddItemSchema).min(1) }))
  .handler(async ({ data: { items } }) => {
    const session = await requireSession()
    const userId = session.user.id

    return db.transaction(async (tx) => {
      // Step 1: Insert new foods for rows where foodId is null
      const resolvedItems = await Promise.all(
        items.map(async (item) => {
          if (item.foodId !== null) {
            return { ...item, foodId: item.foodId }
          }
          if (!item.newFood) {
            throw new Error('newFood is required when foodId is null')
          }
          const [inserted] = await tx
            .insert(food)
            .values({ ...item.newFood, userId })
            .returning()
          return { ...item, foodId: inserted.id }
        }),
      )

      // Ownership check: verify all client-supplied foodIds belong to the current user
      const foodIdsToVerify = resolvedItems.map((i) => i.foodId)

      if (foodIdsToVerify.length > 0) {
        const ownedFoods = await tx
          .select({ id: food.id })
          .from(food)
          .where(and(inArray(food.id, foodIdsToVerify), eq(food.userId, userId)))
        const ownedSet = new Set(ownedFoods.map((f) => f.id))
        for (const id of foodIdsToVerify) {
          if (!ownedSet.has(id)) throw new Error(`Food ${id} not found`)
        }
      }

      // Step 2: Resolve unpacks
      const unpackedItems = await Promise.all(
        resolvedItems.map(async (item) => {
          if (!item.unpack) return item

          const foodRows = await tx
            .select({
              unpacksToFoodId: food.unpacksToFoodId,
              unpackCount: food.unpackCount,
            })
            .from(food)
            .where(and(eq(food.id, item.foodId), eq(food.userId, userId)))
            .limit(1)
          const foodRow = foodRows[0]

          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!foodRow) {
            throw new Error(`Food ${item.foodId} not found or access denied`)
          }

          if (!foodRow.unpacksToFoodId || !foodRow.unpackCount) {
            throw new Error(
              `Food ${item.foodId} has unpack=true but no unpack mapping is configured`,
            )
          }

          return {
            ...item,
            foodId: foodRow.unpacksToFoodId,
            quantity: item.quantity * foodRow.unpackCount,
          }
        }),
      )

      // Step 3: Group by (foodId, location, unit, expiresAt); noMerge rows get a unique key
      const groupMap = new Map<string, { quantity: number; item: typeof unpackedItems[0] }>()
      for (const item of unpackedItems) {
        const groupKey = item.noMerge
          ? `no-merge:${item._rowKey}`
          : JSON.stringify([item.foodId, item.location, item.unit, item.expiresAt ?? null])
        const existing = groupMap.get(groupKey)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          groupMap.set(groupKey, { quantity: item.quantity, item })
        }
      }

      // Step 4: Merge against existing pantry rows
      const resultRows: (typeof pantryItem.$inferSelect)[] = []

      for (const { quantity, item } of groupMap.values()) {
        const expiresAtDate = item.expiresAt ? new Date(item.expiresAt) : null

        const expiresCondition = expiresAtDate === null
          ? isNull(pantryItem.expiresAt)
          : eq(pantryItem.expiresAt, expiresAtDate)

        const existingRows = await tx
          .select()
          .from(pantryItem)
          .where(
            and(
              eq(pantryItem.userId, userId),
              eq(pantryItem.foodId, item.foodId),
              eq(pantryItem.location, item.location),
              eq(pantryItem.unit, item.unit),
              expiresCondition,
            ),
          )
          .limit(1)

        if (existingRows.length > 0) {
          const existing = existingRows[0]
          const [updated] = await tx
            .update(pantryItem)
            .set({ quantity: existing.quantity + quantity })
            .where(eq(pantryItem.id, existing.id))
            .returning()
          resultRows.push(updated)
        } else {
          const [inserted] = await tx
            .insert(pantryItem)
            .values({
              userId,
              foodId: item.foodId,
              quantity,
              unit: item.unit,
              location: item.location,
              expiresAt: expiresAtDate ?? undefined,
              note: item.note,
            })
            .returning()
          resultRows.push(inserted)
        }
      }

      return resultRows
    }, { isolationLevel: 'serializable' })
  })
