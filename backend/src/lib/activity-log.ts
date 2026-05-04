import type { Prisma } from '@prisma/client'
import type { ActivityEntityType, ActivityLogAction, ActivityLogChange } from '../types/domain.js'

interface WriteLogParams {
  projectId: string
  userId: string
  action: ActivityLogAction
  entityType: ActivityEntityType
  entityId: string
  entityName: string
  changes?: ActivityLogChange[]
}

export async function writeActivityLog(
  tx: Prisma.TransactionClient,
  params: WriteLogParams,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      projectId: params.projectId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      changes: (params.changes ?? []) as unknown as Prisma.InputJsonValue,
    },
  })
}

type DiffableValue = string | number | boolean | null | undefined

export function diffFields<T extends Record<string, DiffableValue>>(
  before: T,
  after: Partial<T>,
  fields: (keyof T)[],
): ActivityLogChange[] {
  const out: ActivityLogChange[] = []
  for (const field of fields) {
    if (!(field in after)) continue
    const oldRaw = before[field]
    const newRaw = after[field]
    if (oldRaw === newRaw) continue
    out.push({
      field: String(field),
      oldValue: serializeValue(oldRaw),
      newValue: serializeValue(newRaw),
    })
  }
  return out
}

function serializeValue(value: DiffableValue): string | number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number') return value
  if (typeof value === 'boolean') return value ? 1 : 0
  return value
}
