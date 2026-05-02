import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { queryClient } from '#/integrations/tanstack-query/root-provider'
import {
  listPantry,
  createPantryItem,
  updatePantryItem,
  deletePantryItem,
  type PantryItemWithFood,
} from '#/server/functions/pantry'
import {
  listGroceryLists,
  createGroceryList,
  deleteGroceryList,
} from '#/server/functions/grocery'
import { listFoods, createFood, deleteFood } from '#/server/functions/food'
import type { Food, GroceryList } from '#/db/schema'

// ─── Pantry collection ────────────────────────────────────────────────────────

export const pantryCollection = createCollection(
  queryCollectionOptions<PantryItemWithFood>({
    queryKey: ['pantry'],
    queryFn: () => listPantry(),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await createPantryItem({ data: mut.modified as unknown as Parameters<typeof createPantryItem>[0]['data'] })
      }
    },
    onUpdate: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await updatePantryItem({ data: { id: mut.key as string, data: mut.modified as unknown as Parameters<typeof updatePantryItem>[0]['data']['data'] } })
      }
    },
    onDelete: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await deletePantryItem({ data: { id: mut.key as string } })
      }
    },
  }),
)

// ─── Food catalog collection ──────────────────────────────────────────────────

export const foodCollection = createCollection(
  queryCollectionOptions<Food>({
    queryKey: ['foods'],
    queryFn: () => listFoods(),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await createFood({ data: mut.modified as Parameters<typeof createFood>[0]['data'] })
      }
    },
    onDelete: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await deleteFood({ data: { id: mut.key as string } })
      }
    },
  }),
)

// ─── Grocery lists collection ─────────────────────────────────────────────────

export const groceryListCollection = createCollection(
  queryCollectionOptions<GroceryList>({
    queryKey: ['grocery-lists'],
    queryFn: () => listGroceryLists(),
    queryClient,
    getKey: (item) => item.id,
    onInsert: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await createGroceryList({ data: { name: (mut.modified as GroceryList).name } })
      }
    },
    onDelete: async ({ transaction }) => {
      for (const mut of transaction.mutations) {
        await deleteGroceryList({ data: { id: mut.key as string } })
      }
    },
  }),
)
