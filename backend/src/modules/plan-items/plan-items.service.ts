import type { Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import { canManageProjectPlan } from '../../lib/permissions.js'
import { diffFields, writeActivityLog } from '../../lib/activity-log.js'
import { recalculateProjectProgress } from '../../lib/recalc.js'
import type { ActivityLogAction, AuthUser } from '../../types/domain.js'
import type { SavePlanItemInput } from './plan-items.schema.js'

export async function savePlanItem(
  projectId: string,
  input: SavePlanItemInput,
  user: AuthUser,
) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    const assigneeIds = Array.from(new Set([input.assigneeId, ...input.assigneeIds]))
    const isUpdate = Boolean(input.id)
    const isSubtask = input.parentId !== null

    const dataBase = {
      projectId,
      parentId: input.parentId,
      name: input.name,
      workType: input.workType,
      ownerId: input.ownerId,
      assigneeId: input.assigneeId,
      status: input.status,
      baselineStartDate: new Date(input.baselineStartDate),
      baselineEndDate: new Date(input.baselineEndDate),
      startDate: new Date(input.startDate),
      endDate: new Date(input.endDate),
      progress: input.progress,
      plannedHours: input.plannedHours,
      monthAllocations: input.monthAllocations as unknown as Prisma.InputJsonValue,
      dependencyNote: input.dependencyNote,
      deliverable: input.deliverable,
      replanRequested: input.status === 'NEEDS_REPLAN',
    }

    let saved
    if (isUpdate && input.id) {
      const before = await tx.planItem.findUnique({
        where: { id: input.id },
        include: { assignees: true },
      })
      if (!before) throw new ApiError(404, 'Plan item not found')

      saved = await tx.planItem.update({
        where: { id: input.id },
        data: dataBase,
      })

      await tx.planItemAssignee.deleteMany({ where: { planItemId: input.id } })
      await tx.planItemAssignee.createMany({
        data: assigneeIds.map((userId) => ({ planItemId: input.id!, userId })),
        skipDuplicates: true,
      })

      // Determine which activity action: hours-only vs general update.
      const hourFieldsChanged =
        before.plannedHours !== input.plannedHours ||
        JSON.stringify(before.monthAllocations) !== JSON.stringify(input.monthAllocations)
      const otherChanges = diffFields(
        {
          name: before.name,
          status: before.status,
          progress: before.progress,
          ownerId: before.ownerId,
          assigneeId: before.assigneeId,
        },
        input,
        ['name', 'status', 'progress', 'ownerId', 'assigneeId'],
      )

      if (otherChanges.length === 0 && hourFieldsChanged) {
        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: (isSubtask ? 'SUBTASK_HOURS_CHANGED' : 'TASK_HOURS_CHANGED') as ActivityLogAction,
          entityType: 'PLAN_ITEM',
          entityId: saved.id,
          entityName: saved.name,
          changes: [
            { field: 'plannedHours', oldValue: before.plannedHours, newValue: input.plannedHours },
          ],
        })
      } else if (otherChanges.length > 0) {
        await writeActivityLog(tx, {
          projectId,
          userId: user.id,
          action: (isSubtask ? 'SUBTASK_UPDATED' : 'TASK_UPDATED') as ActivityLogAction,
          entityType: 'PLAN_ITEM',
          entityId: saved.id,
          entityName: saved.name,
          changes: otherChanges,
        })
      }
    } else {
      saved = await tx.planItem.create({
        data: {
          ...dataBase,
          actualHours: 0,
          assignees: { create: assigneeIds.map((userId) => ({ userId })) },
        },
      })
      await writeActivityLog(tx, {
        projectId,
        userId: user.id,
        action: (isSubtask ? 'SUBTASK_CREATED' : 'TASK_CREATED') as ActivityLogAction,
        entityType: 'PLAN_ITEM',
        entityId: saved.id,
        entityName: saved.name,
        changes: [{ field: 'created', oldValue: null, newValue: saved.name }],
      })
    }

    await recalculateProjectProgress(tx, projectId)
    return saved
  })
}

export async function deletePlanItem(projectId: string, planItemId: string, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id: projectId }, include: { members: true } })
    if (!project) throw new ApiError(404, 'Project not found')
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    const item = await tx.planItem.findUnique({ where: { id: planItemId } })
    if (!item || item.projectId !== projectId) throw new ApiError(404, 'Plan item not found')

    const isSubtask = item.parentId !== null
    // Cascade delete is configured on the FK relation — children + assignees + worklogs
    // + delay_raises all get removed automatically by Postgres.
    await tx.planItem.delete({ where: { id: planItemId } })

    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: (isSubtask ? 'SUBTASK_DELETED' : 'TASK_DELETED') as ActivityLogAction,
      entityType: 'PLAN_ITEM',
      entityId: planItemId,
      entityName: item.name,
      changes: [{ field: 'deleted', oldValue: item.name, newValue: null }],
    })
    await recalculateProjectProgress(tx, projectId)
  })
}
