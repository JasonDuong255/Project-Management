// Quick read-only inspection of the existing public schema.
// Run: npx tsx src/db/inspect.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `
  console.log('public tables:', tables.map((t) => t.tablename))

  for (const { tablename } of tables) {
    const count = await prisma.$queryRawUnsafe<{ count: bigint }[]>(
      `select count(*)::bigint as count from public."${tablename}"`,
    )
    console.log(`  ${tablename}: ${count[0].count} rows`)
  }

  const fks = await prisma.$queryRaw<{ table_name: string; constraint_name: string; foreign_schema: string; foreign_table: string }[]>`
    select
      tc.table_name,
      tc.constraint_name,
      ccu.table_schema as foreign_schema,
      ccu.table_name as foreign_table
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and tc.table_schema = 'public'
    order by tc.table_name, tc.constraint_name
  `
  console.log('\nFKs from public:')
  for (const fk of fks) {
    console.log(`  ${fk.table_name}.${fk.constraint_name} -> ${fk.foreign_schema}.${fk.foreign_table}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
