import type { Prisma, PrismaClient } from '@prisma/client'

/**
 * Mirrors the FE behaviour at mockApi.ts:441-455:
 * Project.progress = mean of plan_items.progress for that project.
 * Empty plan list ⇒ leaves progress as-is.
 */
export async function recalculateProjectProgress(
  tx: Prisma.TransactionClient | PrismaClient,
  projectId: string,
): Promise<number> {
  const items = await tx.planItem.findMany({
    where: { projectId },
    select: { progress: true },
  })

  if (items.length === 0) return 0

  const total = items.reduce((sum, item) => sum + item.progress, 0)
  const avg = Math.round(total / items.length)

  await tx.project.update({
    where: { id: projectId },
    data: { progress: avg },
  })

  return avg
}
