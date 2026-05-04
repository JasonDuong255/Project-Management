// One-time script: drop all tables in the public schema so the Prisma schema can be applied fresh.
// All Supabase-managed objects live in auth/storage/realtime/etc. — not public — so this is safe.
// Run: npx tsx src/db/reset-public.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `

  if (tables.length === 0) {
    console.log('public schema already empty.')
    return
  }

  console.log(`Dropping ${tables.length} tables in public schema:`)
  for (const { tablename } of tables) {
    console.log(`  - ${tablename}`)
  }

  // Drop everything via a single statement so FK ordering doesn't matter.
  const dropList = tables.map((t) => `public."${t.tablename}"`).join(', ')
  await prisma.$executeRawUnsafe(`drop table if exists ${dropList} cascade`)

  // Drop any QLDA-specific enum types that Prisma will recreate.
  const enums = await prisma.$queryRaw<{ typname: string }[]>`
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  `
  for (const { typname } of enums) {
    console.log(`  drop enum: ${typname}`)
    await prisma.$executeRawUnsafe(`drop type if exists public."${typname}" cascade`)
  }

  console.log('done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
