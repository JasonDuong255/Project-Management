// Print all test accounts and data counts so the user can verify the demo set.
// Usage: npx tsx src/db/summary.ts
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()

;(async () => {
  const profiles = await p.user.findMany({ orderBy: [{ role: 'asc' }, { username: 'asc' }] })
  console.log('═══ Test accounts (password: 123456) ═══')
  for (const u of profiles) {
    console.log(
      `  ${u.username.padEnd(10)} | ${u.email.padEnd(28)} | role=${u.role.padEnd(16)} | ${u.name}`,
    )
  }

  const projects = await p.project.findMany({
    select: {
      code: true,
      name: true,
      adminId: true,
      status: true,
      progress: true,
      _count: {
        select: { members: true, planItems: true, documents: true, risks: true, monthlyAllocations: true },
      },
    },
    orderBy: { code: 'asc' },
  })
  console.log('\n═══ Projects ═══')
  for (const proj of projects) {
    const admin = profiles.find((u) => u.id === proj.adminId)
    console.log(`  ${proj.code} | ${proj.name}`)
    console.log(
      `    admin=${admin?.username ?? '?'}  status=${proj.status}  progress=${proj.progress}%`,
    )
    console.log(
      `    members=${proj._count.members}  planItems=${proj._count.planItems}  ` +
        `docs=${proj._count.documents}  risks=${proj._count.risks}  allocations=${proj._count.monthlyAllocations}`,
    )
  }

  const counts = await Promise.all([
    p.user.count(),
    p.project.count(),
    p.planItem.count(),
    p.worklog.count(),
    p.delayRaise.count(),
    p.projectMember.count(),
    p.projectRisk.count(),
    p.projectDocument.count(),
    p.monthlyAllocation.count(),
    p.activityLog.count(),
    p.catalogGroup.count(),
  ])
  console.log('\n═══ Total counts ═══')
  const labels = [
    'users',
    'projects',
    'plan items',
    'worklogs',
    'delay raises',
    'project members',
    'risks',
    'documents',
    'allocations',
    'activity logs',
    'catalog groups',
  ]
  labels.forEach((label, i) => console.log(`  ${label.padEnd(18)} ${counts[i]}`))

  await p.$disconnect()
})()
