import { and, asc, eq } from 'drizzle-orm'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { db } from '#/db'
import { food, groceryList, groceryListItem } from '#/db/schema'
import { requireSession } from '#/server/session'
import { UNITS } from '#/lib/units'

const UnitSchema = z.enum(UNITS)

// ─── Grocery Lists ────────────────────────────────────────────────────────────

export const listGroceryLists = createServerFn().handler(async () => {
  const session = await requireSession()
  return db
    .select()
    .from(groceryList)
    .where(eq(groceryList.userId, session.user.id))
    .orderBy(asc(groceryList.createdAt))
})

export const createGroceryList = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ name: z.string().min(1) }))
  .handler(async ({ data }) => {
    const session = await requireSession()
    const [list] = await db
      .insert(groceryList)
      .values({ name: data.name, userId: session.user.id })
      .returning()
    return list
  })

export const updateGroceryList = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), name: z.string().min(1) }))
  .handler(async ({ data: { id, name } }) => {
    const session = await requireSession()
    const [list] = await db
      .update(groceryList)
      .set({ name })
      .where(
        and(eq(groceryList.id, id), eq(groceryList.userId, session.user.id)),
      )
      .returning()
    return list
  })

export const deleteGroceryList = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    const session = await requireSession()
    await db
      .delete(groceryList)
      .where(
        and(eq(groceryList.id, id), eq(groceryList.userId, session.user.id)),
      )
  })

// ─── Grocery List Items ───────────────────────────────────────────────────────

export type GroceryListItemWithFood = {
  id: string
  listId: string
  foodId: string | null
  customLabel: string | null
  quantity: number
  unit: string
  checked: boolean
  note: string | null
  sortIndex: number
  foodName: string | null
  foodImageUrl: string | null
}

export const listGroceryListItems = createServerFn()
  .inputValidator(z.object({ listId: z.string() }))
  .handler(async ({ data: { listId } }) => {
    const session = await requireSession()
    // Verify the list belongs to this user
    const [list] = await db
      .select()
      .from(groceryList)
      .where(
        and(
          eq(groceryList.id, listId),
          eq(groceryList.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!list) throw new Error('Not found')

    return db
      .select({
        id: groceryListItem.id,
        listId: groceryListItem.listId,
        foodId: groceryListItem.foodId,
        customLabel: groceryListItem.customLabel,
        quantity: groceryListItem.quantity,
        unit: groceryListItem.unit,
        checked: groceryListItem.checked,
        note: groceryListItem.note,
        sortIndex: groceryListItem.sortIndex,
        foodName: food.name,
        foodImageUrl: food.imageUrl,
      })
      .from(groceryListItem)
      .leftJoin(food, eq(groceryListItem.foodId, food.id))
      .where(eq(groceryListItem.listId, listId))
      .orderBy(asc(groceryListItem.sortIndex))
  })

const AddItemSchema = z.object({
  listId: z.string(),
  foodId: z.string().optional(),
  customLabel: z.string().optional(),
  quantity: z.number().positive().default(1),
  unit: UnitSchema.default('piece'),
  note: z.string().optional(),
})

export const addGroceryItem = createServerFn({ method: 'POST' })
  .inputValidator(AddItemSchema)
  .handler(async ({ data }) => {
    const session = await requireSession()
    const [list] = await db
      .select()
      .from(groceryList)
      .where(
        and(
          eq(groceryList.id, data.listId),
          eq(groceryList.userId, session.user.id),
        ),
      )
      .limit(1)
    if (!list) throw new Error('Not found')

    const [item] = await db
      .insert(groceryListItem)
      .values(data)
      .returning()
    return item
  })

export const toggleGroceryItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string(), checked: z.boolean() }))
  .handler(async ({ data: { id, checked } }) => {
    await requireSession()
    const [item] = await db
      .update(groceryListItem)
      .set({ checked })
      .where(eq(groceryListItem.id, id))
      .returning()
    return item
  })

export const removeGroceryItem = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ data: { id } }) => {
    await requireSession()
    await db.delete(groceryListItem).where(eq(groceryListItem.id, id))
  })
