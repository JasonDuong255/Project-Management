import type { Prisma } from '@prisma/client'
import { prisma } from '../../db/prisma.js'
import type { NotificationKind } from '@prisma/client'
import { sendEmail } from '../../lib/email.js'

interface PushNotificationParams {
  userIds: string[]
  kind: NotificationKind
  title: string
  body: string
  payload?: Record<string, unknown>
  email?: boolean
}

/**
 * Insert notification rows in the given transaction. Returns the user ids
 * that should receive emails — call `dispatchEmails` AFTER the transaction
 * commits. Doing the email lookup inside the tx triggers pool starvation +
 * tx timeouts on Supabase's pgbouncer.
 */
export async function pushNotification(
  tx: Prisma.TransactionClient,
  params: PushNotificationParams,
): Promise<{ emailUserIds: string[]; subject: string; body: string }> {
  if (params.userIds.length === 0) {
    return { emailUserIds: [], subject: params.title, body: params.body }
  }
  await tx.notification.createMany({
    data: params.userIds.map((userId) => ({
      userId,
      kind: params.kind,
      title: params.title,
      body: params.body,
      payload: (params.payload ?? {}) as Prisma.InputJsonValue,
    })),
  })
  return {
    emailUserIds: params.email ? params.userIds : [],
    subject: params.title,
    body: params.body,
  }
}

/** Best-effort email dispatch. Run after the transaction commits. */
export async function dispatchEmails(
  userIds: string[],
  subject: string,
  body: string,
): Promise<void> {
  if (userIds.length === 0) return
  const recipients = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { email: true },
  })
  for (const r of recipients) {
    void sendEmail({ to: r.email, subject, body })
  }
}

export async function listForUser(userId: string, unreadOnly: boolean) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function markRead(userId: string, notificationId: string) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  })
}

export async function markAllRead(userId: string) {
  return prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
}
