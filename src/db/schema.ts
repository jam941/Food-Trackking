import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ─── Enums ────────────────────────────────────────────────────────────────────

export const unitEnum = pgEnum('unit', [
  'g',
  'kg',
  'ml',
  'l',
  'oz',
  'lb',
  'cup',
  'tbsp',
  'tsp',
  'piece',
  'slice',
])

export const locationEnum = pgEnum('location', [
  'pantry',
  'fridge',
  'freezer',
  'other',
])

// ─── Better Auth tables ───────────────────────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull(),
  image: text('image'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  // Better Auth admin plugin
  role: text('role').notNull().default('user'),
  banned: boolean('banned').notNull().default(false),
  banReason: text('ban_reason'),
  banExpires: timestamp('ban_expires'),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expires_at').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // Better Auth admin plugin (impersonation)
  impersonatedBy: text('impersonated_by'),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at').notNull(),
  updatedAt: timestamp('updated_at').notNull(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
})

// ─── Shared types ─────────────────────────────────────────────────────────────

export type NutritionPer100g = {
  kcal?: number
  protein?: number
  carbs?: number
  fat?: number
  sugar?: number
  salt?: number
  fiber?: number
}

// ─── Food catalog ─────────────────────────────────────────────────────────────

export const food = pgTable(
  'food',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    brand: text('brand'),
    barcode: text('barcode'),
    defaultUnit: unitEnum('default_unit').notNull().default('g'),
    category: text('category'),
    imageUrl: text('image_url'),
    // Populated from Open Food Facts or manual entry.
    // Kept in MVP so v2 recipe nutrition calc needs no backfill.
    nutritionPer100g: jsonb('nutrition_per_100g').$type<NutritionPer100g>(),
    externalSource: text('external_source'), // e.g. 'open_food_facts'
    externalRef: text('external_ref'),       // the original barcode, preserved even if user renames
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Same barcode can only appear once per user; nulls excluded so manual foods don't conflict.
    uniqueIndex('food_user_barcode_idx')
      .on(t.userId, t.barcode)
      .where(sql`${t.barcode} IS NOT NULL`),
    index('food_user_id_idx').on(t.userId),
  ],
)

export type Food = typeof food.$inferSelect
export type NewFood = typeof food.$inferInsert

// ─── Pantry ───────────────────────────────────────────────────────────────────

export const pantryItem = pgTable('pantry_item', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  // v2: recipe "do I have this ingredient?" checks query against this FK
  foodId: text('food_id')
    .notNull()
    .references(() => food.id, { onDelete: 'cascade' }),
  quantity: doublePrecision('quantity').notNull(),
  unit: unitEnum('unit').notNull(),
  location: locationEnum('location').default('pantry'),
  expiresAt: timestamp('expires_at'),
  openedAt: timestamp('opened_at'),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type PantryItem = typeof pantryItem.$inferSelect
export type NewPantryItem = typeof pantryItem.$inferInsert

// ─── Grocery ──────────────────────────────────────────────────────────────────

export const groceryList = pgTable('grocery_list', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  forDate: timestamp('for_date'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type GroceryList = typeof groceryList.$inferSelect

export const groceryListItem = pgTable('grocery_list_item', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  listId: text('list_id')
    .notNull()
    .references(() => groceryList.id, { onDelete: 'cascade' }),
  // v2: recipe-driven generation will set foodId; manual items leave it null
  foodId: text('food_id').references(() => food.id, { onDelete: 'set null' }),
  customLabel: text('custom_label'), // used when foodId is null
  quantity: doublePrecision('quantity').notNull().default(1),
  unit: unitEnum('unit').notNull().default('piece'),
  checked: boolean('checked').notNull().default(false),
  note: text('note'),
  sortIndex: integer('sort_index').notNull().default(0),
})

export type GroceryListItem = typeof groceryListItem.$inferSelect
export type NewGroceryListItem = typeof groceryListItem.$inferInsert

// ─── Open Food Facts cache ────────────────────────────────────────────────────

export type OFFProductData = {
  name: string
  brand?: string
  imageUrl?: string
  quantity?: string
  defaultUnit: string
  nutritionPer100g: NutritionPer100g
  categories?: string[]
}

export const offProductCache = pgTable('off_product_cache', {
  barcode: text('barcode').primaryKey(),
  data: jsonb('data').$type<OFFProductData>().notNull(),
  fetchedAt: timestamp('fetched_at').notNull().defaultNow(),
  etag: text('etag'),
})

// ─── v2 stubs (not yet created — listed here for schema design reference) ─────
// recipe: id, userId, name, instructions, servings, sourceUrl
// recipe_ingredient: recipeId, foodId, quantity, unit, note
// meal_plan_entry: id, userId, date, mealType, recipeId?, customLabel?, servings
