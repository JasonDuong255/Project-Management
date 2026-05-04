import { prisma } from '../../db/prisma.js'
import { ApiError } from '../../middlewares/error.js'
import { canManageProjectPlan, isKSV, isTCNL } from '../../lib/permissions.js'
import { writeActivityLog } from '../../lib/activity-log.js'
import { dispatchEmails, pushNotification } from '../notifications/notifications.service.js'
import type { AuthUser } from '../../types/domain.js'

const TX_OPTS = { timeout: 15000 }
import type {
  KsvDecisionInput,
  RequestCloseInput,
  TcnlDecisionInput,
} from './close-workflow.schema.js'

export async function pauseProject(projectId: string, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })
    if (!project) throw new ApiError(404, 'Project not found')
    if (project.status !== 'ACTIVE') {
      throw new ApiError(400, 'Only ACTIVE projects can be paused')
    }
    if (!canManageProjectPlan(project, user)) throw new ApiError(403, 'Forbidden')

    await tx.project.update({
      where: { id: projectId },
      data: { status: 'PAUSED', pausedAt: new Date() },
    })
    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'PROJECT_PAUSED',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'status', oldValue: 'ACTIVE', newValue: 'PAUSED' }],
    })
    await pushNotification(tx, {
      userIds: project.members.map((m) => m.userId),
      kind: 'PROJECT_PAUSED_NOTICE',
      title: `Dự án ${project.code} tạm đóng`,
      body: `${user.name} đã chuyển dự án "${project.name}" sang trạng thái Tạm đóng.`,
      payload: { projectId },
    })
  }, TX_OPTS)
}

export async function resumeProject(projectId: string, user: AuthUser) {
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    })
    if (!project) throw new ApiError(404, 'Project not found')
    if (project.status !== 'PAUSED') {
      throw new ApiError(400, 'Only PAUSED projects can be resumed')
    }
    // Resuming a paused project shares the same authorization as managing it.
    if (user.role !== 'PMO' && project.adminId !== user.id) {
      throw new ApiError(403, 'Only project admin or PMO can resume')
    }

    await tx.project.update({
      where: { id: projectId },
      data: { status: 'ACTIVE', pausedAt: null },
    })
    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'PROJECT_REOPENED_FROM_PAUSE',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'status', oldValue: 'PAUSED', newValue: 'ACTIVE' }],
    })
  }, TX_OPTS)
}

export async function requestClose(
  projectId: string,
  input: RequestCloseInput,
  user: AuthUser,
) {
  // Pre-fetch KSVs outside the transaction (read-only, doesn't need tx isolation).
  const ksvs = await prisma.user.findMany({
    where: { functionalTitle: 'KSV', isActive: true },
    select: { id: true },
  })

  const result = await prisma.$transaction(async (tx) => {
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: { members: true, closeRequests: true },
    })
    if (!project) throw new ApiError(404, 'Project not found')
    if (project.status === 'CLOSED') {
      throw new ApiError(400, 'Project is already closed')
    }
    if (!canManageProjectPlan(project, user) && project.adminId !== user.id) {
      throw new ApiError(403, 'Only QLDA can request close')
    }
    const openRequest = project.closeRequests.find(
      (r) =>
        r.ksvDecision === 'PENDING' ||
        (r.ksvDecision === 'APPROVED' && r.tcnlDecision === 'PENDING'),
    )
    if (openRequest) {
      throw new ApiError(409, 'A close request is already in progress')
    }

    const created = await tx.projectCloseRequest.create({
      data: {
        projectId,
        requestedById: user.id,
        note: input.note,
      },
    })

    const emailJob = await pushNotification(tx, {
      userIds: ksvs.map((k) => k.id),
      kind: 'CLOSE_REQUEST_RECEIVED',
      title: `Yêu cầu đóng TTK: ${project.code}`,
      body: `${user.name} đã gửi yêu cầu đóng TTK cho dự án "${project.name}". Vui lòng xem xét và phê duyệt.`,
      payload: { projectId, closeRequestId: created.id, role: 'KSV' },
      email: true,
    })

    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'CLOSE_REQUESTED',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: project.name,
      changes: [{ field: 'note', oldValue: null, newValue: input.note }],
    })

    return { closeRequestId: created.id, emailJob }
  }, TX_OPTS)

  void dispatchEmails(result.emailJob.emailUserIds, result.emailJob.subject, result.emailJob.body)
  return result.closeRequestId
}

export async function ksvDecide(
  projectId: string,
  closeRequestId: string,
  input: KsvDecisionInput,
  user: AuthUser,
) {
  if (!isKSV(user)) {
    throw new ApiError(403, 'Only KSV can make this decision')
  }
  // Pre-fetch TCNL list outside the transaction to keep the tx short.
  const tcnls =
    input.decision === 'APPROVED'
      ? await prisma.user.findMany({
          where: { functionalTitle: 'TCNL', isActive: true },
          select: { id: true },
        })
      : []

  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.projectCloseRequest.findUnique({
      where: { id: closeRequestId },
      include: { project: true },
    })
    if (!request || request.projectId !== projectId) {
      throw new ApiError(404, 'Close request not found')
    }
    if (request.ksvDecision !== 'PENDING') {
      throw new ApiError(409, 'KSV decision already recorded')
    }

    await tx.projectCloseRequest.update({
      where: { id: closeRequestId },
      data: {
        ksvDecision: input.decision,
        ksvDecidedById: user.id,
        ksvDecidedAt: new Date(),
        ksvRejectReason: input.decision === 'REJECTED' ? input.reason : '',
      },
    })

    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: input.decision === 'APPROVED' ? 'CLOSE_APPROVED_KSV' : 'CLOSE_REJECTED_KSV',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: request.project.name,
      changes: [{ field: 'ksvDecision', oldValue: 'PENDING', newValue: input.decision }],
    })

    if (input.decision === 'APPROVED') {
      const job = await pushNotification(tx, {
        userIds: tcnls.map((t) => t.id),
        kind: 'CLOSE_REQUEST_RECEIVED',
        title: `Đóng TTK: ${request.project.code} chờ TCNL xác nhận`,
        body: `KSV đã phê duyệt yêu cầu đóng dự án "${request.project.name}". Vui lòng xác nhận đóng.`,
        payload: { projectId, closeRequestId, role: 'TCNL' },
        email: true,
      })
      return { emailJob: job }
    }
    const job = await pushNotification(tx, {
      userIds: [request.requestedById],
      kind: 'CLOSE_REJECTED',
      title: `Yêu cầu đóng ${request.project.code} bị từ chối (KSV)`,
      body: input.reason || 'KSV không phê duyệt yêu cầu đóng. Vui lòng kiểm tra và gửi lại.',
      payload: { projectId, closeRequestId, stage: 'KSV' },
      email: true,
    })
    return { emailJob: job }
  }, TX_OPTS)

  void dispatchEmails(result.emailJob.emailUserIds, result.emailJob.subject, result.emailJob.body)
}

export async function tcnlDecide(
  projectId: string,
  closeRequestId: string,
  input: TcnlDecisionInput,
  user: AuthUser,
) {
  if (!isTCNL(user)) {
    throw new ApiError(403, 'Only TCNL can make this decision')
  }
  const result = await prisma.$transaction(async (tx) => {
    const request = await tx.projectCloseRequest.findUnique({
      where: { id: closeRequestId },
      include: { project: true },
    })
    if (!request || request.projectId !== projectId) {
      throw new ApiError(404, 'Close request not found')
    }
    if (request.ksvDecision !== 'APPROVED') {
      throw new ApiError(409, 'KSV must approve before TCNL decision')
    }
    if (request.tcnlDecision !== 'PENDING') {
      throw new ApiError(409, 'TCNL decision already recorded')
    }

    await tx.projectCloseRequest.update({
      where: { id: closeRequestId },
      data: {
        tcnlDecision: input.decision,
        tcnlDecidedById: user.id,
        tcnlDecidedAt: new Date(),
        tcnlRejectReason: input.decision === 'REJECTED' ? input.reason : '',
      },
    })

    if (input.decision === 'APPROVED') {
      await tx.project.update({
        where: { id: projectId },
        data: { status: 'CLOSED', closedAt: new Date() },
      })
      await writeActivityLog(tx, {
        projectId,
        userId: user.id,
        action: 'CLOSE_CONFIRMED_TCNL',
        entityType: 'PROJECT',
        entityId: projectId,
        entityName: request.project.name,
        changes: [{ field: 'status', oldValue: request.project.status, newValue: 'CLOSED' }],
      })
      const job = await pushNotification(tx, {
        userIds: [request.requestedById],
        kind: 'CLOSE_APPROVED',
        title: `Dự án ${request.project.code} đã được đóng`,
        body: `TCNL đã xác nhận đóng dự án "${request.project.name}".`,
        payload: { projectId, closeRequestId },
        email: true,
      })
      return { emailJob: job }
    }
    await writeActivityLog(tx, {
      projectId,
      userId: user.id,
      action: 'CLOSE_REJECTED_TCNL',
      entityType: 'PROJECT',
      entityId: projectId,
      entityName: request.project.name,
      changes: [{ field: 'tcnlDecision', oldValue: 'PENDING', newValue: 'REJECTED' }],
    })
    const job = await pushNotification(tx, {
      userIds: [request.requestedById],
      kind: 'CLOSE_REJECTED',
      title: `Yêu cầu đóng ${request.project.code} bị từ chối (TCNL)`,
      body: input.reason || 'TCNL không xác nhận đóng. Vui lòng kiểm tra và gửi lại.',
      payload: { projectId, closeRequestId, stage: 'TCNL' },
      email: true,
    })
    return { emailJob: job }
  }, TX_OPTS)

  void dispatchEmails(result.emailJob.emailUserIds, result.emailJob.subject, result.emailJob.body)
}

/** List close-requests visible to the current user (their inbox). */
export async function inboxFor(user: AuthUser) {
  if (isKSV(user)) {
    return prisma.projectCloseRequest.findMany({
      where: { ksvDecision: 'PENDING' },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { requestedAt: 'desc' },
    })
  }
  if (isTCNL(user)) {
    return prisma.projectCloseRequest.findMany({
      where: { ksvDecision: 'APPROVED', tcnlDecision: 'PENDING' },
      include: { project: { select: { id: true, code: true, name: true } } },
      orderBy: { ksvDecidedAt: 'desc' },
    })
  }
  // Requesters see their own pending requests.
  return prisma.projectCloseRequest.findMany({
    where: { requestedById: user.id },
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: { requestedAt: 'desc' },
  })
}

