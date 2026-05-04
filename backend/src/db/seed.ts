// Idempotent seed: imports public/mock/*.json from the FE into Supabase Auth + Postgres.
// Usage:
//   npx tsx src/db/seed.ts          # default: wipes public-schema data, recreates auth users
//   npx tsx src/db/seed.ts --keep   # preserves existing rows where possible
import 'dotenv/config'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PrismaClient, type Prisma } from '@prisma/client'
import { supabaseAdmin } from '../lib/supabase.js'
import { normalizeUserRole } from '../lib/normalize.js'
import type { CatalogKey } from '../types/domain.js'

const prisma = new PrismaClient()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const MOCK_DIR = path.resolve(__dirname, '..', '..', '..', 'front-end', 'public', 'mock')

interface SeedUser {
  id: string
  name: string
  email?: string
  username: string
  password: string
  role: string
  employeeCode?: string
  title?: string
  unit?: string
  phone?: string
  monthlyCapacity?: number
  avatarColor?: string
}

interface SeedProject {
  id: string
  code: string
  name: string
  summary?: string
  sponsor?: string
  department?: string
  objective?: string
  ttkDecisionNumber?: string
  createdById: string
  adminId: string
  memberIds?: string[]
  startDate: string
  endDate: string
  status: string
  health: string
  progress?: number
  currentPhase?: string
  adjustedPlan?: string
  riskSummary?: string
  approvalInfo?: Record<string, unknown>
  basisInfo?: Record<string, unknown>
  financialInfo?: Record<string, unknown>
  personnelInfo?: { aitsMembers?: { userId?: string }[] } & Record<string, unknown>
  documents?: SeedDocument[]
  monthlyAllocations?: { memberId: string; month: string; hours: number }[]
  risks?: SeedRisk[]
}

interface SeedDocument {
  id: string
  title: string
  category?: string
  documentNumber?: string
  description?: string
  url?: string
  uploadedBy: string
  uploadedAt?: string
  updatedBy?: string
  updatedAt?: string
}

interface SeedRisk {
  id: string
  title: string
  level: string
  status: string
  ownerId: string
  mitigation?: string
  lastUpdated?: string
}

interface SeedPlanItem {
  id: string
  projectId: string
  parentId: string | null
  name: string
  workType: string
  ownerId: string
  assigneeId: string
  assigneeIds?: string[]
  status: string
  baselineStartDate: string
  baselineEndDate: string
  startDate: string
  endDate: string
  progress?: number
  plannedHours?: number
  actualHours?: number
  monthAllocations?: { month: string; hours: number }[]
  dependencyNote?: string
  deliverable?: string
  replanRequested?: boolean
}

interface SeedWorklog {
  id: string
  taskId: string
  projectId: string
  memberId: string
  date: string
  hours: number
  progressNote?: string
}

interface SeedDelayRaise {
  id: string
  projectId: string
  taskId: string
  requesterId: string
  requestedAt: string
  reason?: string
  impact?: string
  status: string
  managerResponse?: string
}

function loadJson<T>(name: string): T {
  const file = path.join(MOCK_DIR, name)
  return JSON.parse(readFileSync(file, 'utf8')) as T
}

export async function runSeed(opts: { wipe?: boolean } = {}) {
  const wipe = opts.wipe ?? true

  console.log(`[seed] mock dir: ${MOCK_DIR}`)
  console.log(`[seed] wipe=${wipe}`)

  const seedUsers = loadJson<SeedUser[]>('users.json')
  const seedProjects = loadJson<SeedProject[]>('projects.json')
  const seedPlanItems = loadJson<SeedPlanItem[]>('plan-items.json')
  const seedWorklogs = loadJson<SeedWorklog[]>('worklogs.json')
  const seedDelays = loadJson<SeedDelayRaise[]>('delay-raises.json')
  const seedCatalogs = loadJson<Record<CatalogKey, unknown[]>>('catalogs.json')

  // ─── 1. Wipe public-schema data (preserves auth.users) ────────────────
  if (wipe) {
    console.log('[seed] wiping public tables…')
    await prisma.activityLog.deleteMany()
    await prisma.delayRaise.deleteMany()
    await prisma.worklog.deleteMany()
    await prisma.planItemAssignee.deleteMany()
    await prisma.planItem.deleteMany()
    await prisma.projectRisk.deleteMany()
    await prisma.monthlyAllocation.deleteMany()
    await prisma.projectDocument.deleteMany()
    await prisma.projectMember.deleteMany()
    await prisma.project.deleteMany()
    await prisma.user.deleteMany()
    await prisma.catalogGroup.deleteMany()
  }

  // ─── 2. Create auth users + profiles, build mockId → uuid map ─────────
  console.log('[seed] creating auth users + profiles…')
  const idMap = new Map<string, string>() // mockId → real auth uuid

  for (const u of seedUsers) {
    // Always synthesize emails as <username>@qlda.local so the FE login flow
    // can append the suffix when a user types just a username. The real emails
    // in users.json (e.g. chau.pmo@company.vn) are preserved on the profile row
    // but not used for Supabase Auth.
    const email = `${u.username}@qlda.local`

    // Try to find an existing auth user by email (idempotency).
    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    })
    const found = existing.users.find((x) => x.email?.toLowerCase() === email.toLowerCase())

    let authId: string
    if (found) {
      authId = found.id
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: u.password,
        email_confirm: true,
        user_metadata: { username: u.username, role: u.role },
      })
      if (error || !data.user) {
        throw new Error(`Failed to create auth user ${u.username}: ${error?.message}`)
      }
      authId = data.user.id
    }

    idMap.set(u.id, authId)

    // v3.1 BRD I: assign TCNL/KSV functional titles on demo users so v3.2's
    // close-workflow has live test users.  dev.duy → KSV, dev.khang → TCNL.
    const functionalTitle =
      u.username === 'dev.duy' ? 'KSV' : u.username === 'dev.khang' ? 'TCNL' : 'NORMAL'

    await prisma.user.upsert({
      where: { id: authId },
      create: {
        id: authId,
        username: u.username,
        email: u.email && u.email.includes('@') ? u.email : email,
        name: u.name,
        role: normalizeUserRole(u.role),
        functionalTitle,
        isActive: true,
        employeeCode: u.employeeCode ?? '',
        title: u.title ?? '',
        unit: u.unit ?? '',
        phone: u.phone ?? '',
        monthlyCapacity: u.monthlyCapacity ?? 160,
        avatarColor: u.avatarColor ?? '#0f766e',
      },
      update: {
        username: u.username,
        email: u.email && u.email.includes('@') ? u.email : email,
        name: u.name,
        role: normalizeUserRole(u.role),
        functionalTitle,
        isActive: true,
        employeeCode: u.employeeCode ?? '',
        title: u.title ?? '',
        unit: u.unit ?? '',
        phone: u.phone ?? '',
        monthlyCapacity: u.monthlyCapacity ?? 160,
        avatarColor: u.avatarColor ?? '#0f766e',
      },
    })
  }
  console.log(`[seed] ${idMap.size} users ready.`)

  // ─── 3. Catalogs ──────────────────────────────────────────────────────
  console.log('[seed] writing catalog groups…')
  for (const key of Object.keys(seedCatalogs) as CatalogKey[]) {
    await prisma.catalogGroup.upsert({
      where: { key },
      create: { key, values: seedCatalogs[key] as Prisma.InputJsonValue },
      update: { values: seedCatalogs[key] as Prisma.InputJsonValue },
    })
  }

  // ─── 4. Projects ──────────────────────────────────────────────────────
  console.log('[seed] writing projects…')
  for (const p of seedProjects) {
    const adminId = idMap.get(p.adminId)
    if (!adminId) {
      console.warn(`[seed] skipping project ${p.code} — admin not in map (mockId=${p.adminId})`)
      continue
    }
    // Fallback chain: explicit createdById → adminId. Older mock data omits it.
    const createdById = (p.createdById && idMap.get(p.createdById)) || adminId

    const memberIds = (p.memberIds ?? [])
      .map((mockId) => idMap.get(mockId))
      .filter((x): x is string => Boolean(x))

    const personnelInfo = remapPersonnelUserIds(p.personnelInfo, idMap)
    const approvalInfo = remapApprovalUserIds(p.approvalInfo, idMap, createdById)

    // v3.1: build project_member rows with isCoordinator + role/responsibility
    // sourced from the JSONB personnelInfo.aitsMembers entries (matched by userId).
    const aitsByUserId = new Map<string, { role?: string; responsibility?: string; totalPlannedHours?: number }>()
    for (const aits of (p.personnelInfo?.aitsMembers ?? [])) {
      const realId = aits.userId ? idMap.get(aits.userId) : undefined
      if (realId) {
        aitsByUserId.set(realId, aits as { role?: string; responsibility?: string; totalPlannedHours?: number })
      }
    }
    const memberRowData = memberIds.map((userId) => {
      const aits = aitsByUserId.get(userId)
      const role = aits?.role ?? ''
      return {
        userId,
        isCoordinator: /dieu phoi du an/i.test(role),
        roleInProject: role,
        responsibility: aits?.responsibility ?? '',
        totalPlannedHours: aits?.totalPlannedHours ?? 0,
      }
    })

    // v3.1: BRD has 3 status values. Mock data uses 5; fold into the new ones.
    const seedStatus = ['INITIATION', 'PLANNING', 'IN_PROGRESS', 'AT_RISK'].includes(p.status)
      ? 'ACTIVE'
      : p.status === 'DONE'
        ? 'CLOSED'
        : (p.status as 'ACTIVE' | 'PAUSED' | 'CLOSED')
    // BRD has 3 health values. Mock data uses GREEN/AMBER/RED; map.
    const seedHealth =
      p.health === 'GREEN' ? 'STABLE' : p.health === 'AMBER' ? 'NEEDS_REVIEW' : p.health === 'RED' ? 'AT_RISK' : (p.health as 'STABLE' | 'NEEDS_REVIEW' | 'AT_RISK')

    await prisma.project.create({
      data: {
        id: p.id,
        code: p.code,
        name: p.name,
        summary: p.summary ?? '',
        sponsor: p.sponsor ?? '',
        department: p.department ?? '',
        objective: p.objective ?? '',
        ttkDecisionNumber: p.ttkDecisionNumber ?? '',
        createdById,
        adminId,
        startDate: new Date(p.startDate),
        endDate: new Date(p.endDate),
        status: seedStatus,
        health: seedHealth,
        progress: p.progress ?? 0,
        currentPhase: p.currentPhase ?? '',
        adjustedPlan: p.adjustedPlan ?? '',
        riskSummary: p.riskSummary ?? '',
        approvalInfo: approvalInfo as Prisma.InputJsonValue,
        basisInfo: (p.basisInfo ?? {}) as Prisma.InputJsonValue,
        financialInfo: (p.financialInfo ?? {}) as Prisma.InputJsonValue,
        personnelInfo: personnelInfo as Prisma.InputJsonValue,
        members: { create: memberRowData },
        documents: {
          create: (p.documents ?? []).map((d) => ({
            id: d.id,
            title: d.title,
            category: d.category ?? '',
            documentNumber: d.documentNumber ?? '',
            description: d.description ?? '',
            url: d.url ?? '',
            uploadedBy: idMap.get(d.uploadedBy) ?? createdById,
            uploadedAt: d.uploadedAt ? new Date(d.uploadedAt) : new Date(),
            updatedBy: d.updatedBy ? (idMap.get(d.updatedBy) ?? null) : null,
            updatedAt: d.updatedAt ? new Date(d.updatedAt) : null,
          })),
        },
        monthlyAllocations: {
          create: (p.monthlyAllocations ?? [])
            .map((a) => {
              const memberId = idMap.get(a.memberId)
              if (!memberId) return null
              return { memberId, month: a.month, hours: a.hours }
            })
            .filter((x): x is { memberId: string; month: string; hours: number } => x !== null),
        },
        risks: {
          create: (p.risks ?? []).map((r) => ({
            id: r.id,
            title: r.title,
            level: r.level as Parameters<typeof prisma.projectRisk.create>[0]['data']['level'],
            status: r.status as Parameters<typeof prisma.projectRisk.create>[0]['data']['status'],
            ownerId: idMap.get(r.ownerId) ?? createdById,
            mitigation: r.mitigation ?? '',
            lastUpdated: r.lastUpdated ? new Date(r.lastUpdated) : new Date(),
          })),
        },
      },
    })
  }

  // ─── 5. Plan items ────────────────────────────────────────────────────
  console.log('[seed] writing plan items…')
  // Insert parents first then children so the parentId FK resolves.
  const parents = seedPlanItems.filter((p) => p.parentId === null)
  const children = seedPlanItems.filter((p) => p.parentId !== null)
  for (const item of [...parents, ...children]) {
    const ownerId = idMap.get(item.ownerId)
    const assigneeId = idMap.get(item.assigneeId)
    if (!ownerId || !assigneeId) continue
    const assigneeIds = Array.from(
      new Set([
        assigneeId,
        ...(item.assigneeIds ?? [])
          .map((m) => idMap.get(m))
          .filter((x): x is string => Boolean(x)),
      ]),
    )

    await prisma.planItem.create({
      data: {
        id: item.id,
        projectId: item.projectId,
        parentId: item.parentId,
        name: item.name,
        workType: item.workType as Parameters<typeof prisma.planItem.create>[0]['data']['workType'],
        ownerId,
        assigneeId,
        status: item.status as Parameters<typeof prisma.planItem.create>[0]['data']['status'],
        baselineStartDate: new Date(item.baselineStartDate),
        baselineEndDate: new Date(item.baselineEndDate),
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate),
        progress: item.progress ?? 0,
        plannedHours: item.plannedHours ?? 0,
        actualHours: item.actualHours ?? 0,
        monthAllocations: (item.monthAllocations ?? []) as Prisma.InputJsonValue,
        dependencyNote: item.dependencyNote ?? '',
        deliverable: item.deliverable ?? '',
        replanRequested: item.replanRequested ?? false,
        assignees: { create: assigneeIds.map((userId) => ({ userId })) },
      },
    })
  }

  // ─── 6. Worklogs ──────────────────────────────────────────────────────
  console.log('[seed] writing worklogs…')
  for (const w of seedWorklogs) {
    const memberId = idMap.get(w.memberId)
    if (!memberId) continue
    await prisma.worklog.create({
      data: {
        id: w.id,
        taskId: w.taskId,
        projectId: w.projectId,
        memberId,
        date: new Date(w.date),
        hours: w.hours,
        progressNote: w.progressNote ?? '',
      },
    })
  }

  // ─── 7. Delay raises ──────────────────────────────────────────────────
  console.log('[seed] writing delay raises…')
  for (const d of seedDelays) {
    const requesterId = idMap.get(d.requesterId)
    if (!requesterId) continue
    await prisma.delayRaise.create({
      data: {
        id: d.id,
        projectId: d.projectId,
        taskId: d.taskId,
        requesterId,
        requestedAt: new Date(d.requestedAt),
        reason: d.reason ?? '',
        impact: d.impact ?? '',
        status: d.status as Parameters<typeof prisma.delayRaise.create>[0]['data']['status'],
        managerResponse: d.managerResponse ?? '',
      },
    })
  }

  console.log('[seed] done.')
}

function remapPersonnelUserIds(
  info: SeedProject['personnelInfo'] | undefined,
  idMap: Map<string, string>,
): Record<string, unknown> {
  if (!info) return { aitsMembers: [], customerMembers: [], partners: [] }
  const aitsMembers = ((info as { aitsMembers?: { userId?: string }[] }).aitsMembers ?? []).map(
    (m) => ({
      ...m,
      userId: m.userId ? (idMap.get(m.userId) ?? '') : '',
    }),
  )
  return { ...info, aitsMembers }
}

function remapApprovalUserIds(
  info: Record<string, unknown> | undefined,
  idMap: Map<string, string>,
  fallback: string,
): Record<string, unknown> {
  if (!info) {
    return {
      status: 'PENDING',
      requestedById: fallback,
      requestFileName: '',
      requestSubmittedAt: '',
      approvedById: '',
      approvedAt: '',
      approvalFileName: '',
      note: '',
    }
  }
  const out = { ...info }
  if (typeof out.requestedById === 'string') {
    out.requestedById = idMap.get(out.requestedById) ?? fallback
  }
  if (typeof out.approvedById === 'string' && out.approvedById !== '') {
    out.approvedById = idMap.get(out.approvedById) ?? ''
  }
  return out
}

// CLI entry lives in src/db/seed-cli.ts so importing this module from runtime
// code (e.g. admin.routes.ts) does not trigger the seed.
