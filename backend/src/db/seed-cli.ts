// CLI wrapper around runSeed.
// Usage: npx tsx src/db/seed-cli.ts [--keep]
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { runSeed } from './seed.js'

const prisma = new PrismaClient()

runSeed({ wipe: !process.argv.includes('--keep') })
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error('[seed] failed:', err)
    void prisma.$disconnect()
    process.exit(1)
  })
