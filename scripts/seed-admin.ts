import { config } from 'dotenv'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, and } from 'drizzle-orm'
import { hashPassword } from 'better-auth/crypto'
import { user as userTable, account as accountTable } from '../src/db/schema.ts'

config({ path: '.env.local' })

const ADMIN_EMAIL = 'admin@admin.com'
const ADMIN_PASSWORD = 'admin'
const ADMIN_NAME = 'admin'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool)

const existing = await db
  .select({ id: userTable.id })
  .from(userTable)
  .where(eq(userTable.email, ADMIN_EMAIL))
  .limit(1)

const hashed = await hashPassword(ADMIN_PASSWORD)
const now = new Date()

if (existing.length > 0) {
  const userId = existing[0].id
  await db.update(userTable).set({ role: 'admin' }).where(eq(userTable.email, ADMIN_EMAIL))

  const existingAccount = await db
    .select({ id: accountTable.id })
    .from(accountTable)
    .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'credential')))
    .limit(1)

  if (existingAccount.length > 0) {
    await db
      .update(accountTable)
      .set({ password: hashed, updatedAt: now })
      .where(and(eq(accountTable.userId, userId), eq(accountTable.providerId, 'credential')))
  } else {
    await db.insert(accountTable).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: hashed,
      createdAt: now,
      updatedAt: now,
    })
  }
  console.log(`Bootstrap admin reset: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
} else {
  const id = crypto.randomUUID()

  await db.insert(userTable).values({
    id,
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    emailVerified: true,
    role: 'admin',
    banned: false,
    createdAt: now,
    updatedAt: now,
  })

  await db.insert(accountTable).values({
    id: crypto.randomUUID(),
    accountId: id,
    providerId: 'credential',
    userId: id,
    password: hashed,
    createdAt: now,
    updatedAt: now,
  })

  console.log(`Bootstrap admin created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
}

console.log('Sign in, create your real account via /admin/users, promote it to admin, sign in as your real account, then delete this one.')

await pool.end()
