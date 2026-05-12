// End-to-end smoke test: log in as different roles, exercise every mutation,
// verify no dead endpoints. Cleans up by calling reset-demo-data at the end.
//
// Usage: backend running on :4000, then `npx tsx src/db/e2e-test.ts`
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
const API = `http://localhost:${process.env.PORT ?? 4000}/api`

interface Snapshot {
  currentUser: { id: string; role: string; name: string }
  users: { id: string; username: string; role: string }[]
  projects: {
    id: string
    code: string
    name: string
    summary: string
    progress: number
    status: string
    members: { userId: string }[] | undefined
    memberIds: string[]
    documents: { id: string; title: string }[]
    risks: { id: string; title: string }[]
    monthlyAllocations: { memberId: string; month: string; hours: number }[]
  }[]
  planItems: { id: string; projectId: string; name: string; progress: number; status: string }[]
  worklogs: { id: string; taskId: string; hours: number }[]
  delayRaises: { id: string; status: string }[]
  activityLogs: { id: string; action: string }[]
  catalogs: Record<string, { value: string; label: string }[]>
}

async function login(email: string) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password: '123456' })
  if (error || !data.session) throw new Error(`login ${email}: ${error?.message}`)
  return data.session.access_token
}

async function api<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`)
  return res.json() as Promise<T>
}

function step(name: string) {
  console.log(`  ▸ ${name}`)
}

async function main() {
  console.log('▶ E2E test')

  console.log('\n[1] PMO can read all 3 projects')
  const pmoToken = await login('sys.chau@qlda.local')
  const pmoSnap = await api<Snapshot>(pmoToken, '/snapshot')
  console.log(`  PMO sees ${pmoSnap.projects.length} projects, ${pmoSnap.planItems.length} plan items`)
  if (pmoSnap.projects.length !== 3) throw new Error(`expected 3 projects, got ${pmoSnap.projects.length}`)

  const adminId = pmoSnap.users.find((u) => u.username === 'pm.an')!.id
  // Pick a project where pm.an is the admin so the PM-side actions in [4]/[6]/[7] pass.
  const targetProject = pmoSnap.projects.find((p) =>
    pmoSnap.users.some((u) => u.username === 'pm.an' && u.id === (p as { adminId?: string }).adminId),
  )
  const projectId = (targetProject ?? pmoSnap.projects[0]!).id
  const memberId = (targetProject ?? pmoSnap.projects[0]!).memberIds[0] ?? adminId

  console.log('\n[2] PMO updates project summary')
  step('PATCH /projects/:id { summary }')
  const newSummary = `E2E touch ${Date.now()}`
  const updated = await api<Snapshot>(pmoToken, `/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch: { summary: newSummary } }),
  })
  const updatedProj = updated.projects.find((p) => p.id === projectId)!
  if (updatedProj.summary !== newSummary) throw new Error('summary did not update')
  console.log(`  ✓ summary updated, activity log entries: ${updated.activityLogs.length}`)

  console.log('\n[3] Add a project document')
  step('POST /projects/:id/documents')
  const docSnap = await api<Snapshot>(pmoToken, `/projects/${projectId}/documents`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Document',
      category: 'CONTRACT',
      description: 'auto',
      url: 'https://example.com/e2e.pdf',
      uploadedBy: pmoSnap.currentUser.id,
    }),
  })
  const newDoc = docSnap.projects
    .find((p) => p.id === projectId)!
    .documents.find((d) => d.title === 'E2E Document')
  if (!newDoc) throw new Error('document not added')
  console.log(`  ✓ doc id=${newDoc.id}`)

  step('PATCH /projects/:id/documents/:docId')
  await api<Snapshot>(pmoToken, `/projects/${projectId}/documents/${newDoc.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ title: 'E2E Document v2', updatedBy: pmoSnap.currentUser.id }),
  })
  step('DELETE /projects/:id/documents/:docId')
  await api<Snapshot>(pmoToken, `/projects/${projectId}/documents/${newDoc.id}`, {
    method: 'DELETE',
  })
  console.log('  ✓ doc cycle complete')

  console.log('\n[4] PM creates plan item then a subtask')
  // canManageProjectPlan now only requires project.status === 'ACTIVE'.
  // Approval flow has been removed (BA decision 12/05/2026).

  const pmToken = await login('pm.an@qlda.local')
  step('POST /projects/:id/plan-items (parent)')
  const planSnap = await api<Snapshot>(pmToken, `/projects/${projectId}/plan-items`, {
    method: 'POST',
    body: JSON.stringify({
      parentId: null,
      name: 'E2E Parent Task',
      workType: 'PRELIMINARY',
      ownerId: adminId,
      assigneeId: memberId,
      assigneeIds: [memberId],
      status: 'NOT_STARTED',
      baselineStartDate: '2026-05-01',
      baselineEndDate: '2026-05-31',
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      progress: 0,
      plannedHours: 40,
      monthAllocations: [{ month: '2026-05', hours: 40 }],
      dependencyNote: '',
      deliverable: 'parent deliverable',
    }),
  })
  const parent = planSnap.planItems.find((t) => t.name === 'E2E Parent Task')!
  console.log(`  ✓ parent id=${parent.id}`)

  step('POST /projects/:id/plan-items (subtask)')
  const subSnap = await api<Snapshot>(pmToken, `/projects/${projectId}/plan-items`, {
    method: 'POST',
    body: JSON.stringify({
      parentId: parent.id,
      name: 'E2E Subtask',
      workType: 'SUBTASK',
      ownerId: adminId,
      assigneeId: memberId,
      assigneeIds: [memberId],
      status: 'NOT_STARTED',
      baselineStartDate: '2026-05-01',
      baselineEndDate: '2026-05-15',
      startDate: '2026-05-01',
      endDate: '2026-05-15',
      progress: 0,
      plannedHours: 16,
      monthAllocations: [{ month: '2026-05', hours: 16 }],
      dependencyNote: '',
      deliverable: '',
    }),
  })
  const subtask = subSnap.planItems.find((t) => t.name === 'E2E Subtask')!
  console.log(`  ✓ subtask id=${subtask.id}`)

  console.log('\n[5] DELIVERY_MEMBER logs work + raises delay')
  const memberToken = await login('dev.binh@qlda.local')
  // dev.binh may not be a member of this specific project; use whichever member is.
  const memberSnap = await api<Snapshot>(memberToken, '/snapshot')
  const memberProject = memberSnap.projects[0]
  if (memberProject) {
    const memberTask = memberSnap.planItems.find((t) => t.projectId === memberProject.id)
    if (memberTask) {
      step('POST /projects/:id/worklogs')
      await api<Snapshot>(memberToken, `/projects/${memberProject.id}/worklogs`, {
        method: 'POST',
        body: JSON.stringify({
          taskId: memberTask.id,
          memberId: memberSnap.currentUser.id,
          date: '2026-05-01',
          hours: 4,
          progressNote: 'e2e worklog',
          progress: Math.min(100, memberTask.progress + 10),
        }),
      })
      step('POST /projects/:id/delay-raises')
      await api<Snapshot>(memberToken, `/projects/${memberProject.id}/delay-raises`, {
        method: 'POST',
        body: JSON.stringify({
          taskId: memberTask.id,
          requesterId: memberSnap.currentUser.id,
          reason: 'e2e delay',
          impact: 'minimal',
        }),
      })
      console.log('  ✓ worklog + delay raise OK')
    } else {
      console.log('  (skip — member has no tasks)')
    }
  }

  console.log('\n[6] PM saves a risk + allocation')
  step('POST /projects/:id/risks')
  await api<Snapshot>(pmToken, `/projects/${projectId}/risks`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'E2E Risk',
      level: 'MEDIUM',
      status: 'OPEN',
      ownerId: adminId,
      mitigation: 'monitor',
    }),
  })
  step('POST /projects/:id/allocations')
  await api<Snapshot>(pmToken, `/projects/${projectId}/allocations`, {
    method: 'POST',
    body: JSON.stringify({ memberId, month: '2026-06', hours: 80 }),
  })
  console.log('  ✓ risk + allocation OK')

  console.log('\n[7] Delete the e2e parent (cascades to subtask + worklogs)')
  step('DELETE /projects/:id/plan-items/:taskId')
  const afterDelete = await api<Snapshot>(pmToken, `/projects/${projectId}/plan-items/${parent.id}`, {
    method: 'DELETE',
  })
  if (afterDelete.planItems.find((t) => t.id === parent.id)) throw new Error('parent still present')
  if (afterDelete.planItems.find((t) => t.id === subtask.id)) throw new Error('subtask still present')
  console.log('  ✓ cascade delete confirmed')

  console.log('\n[8] PMO updates a catalog entry')
  step('PATCH /catalogs/:groupKey')
  const cat = await api<Snapshot>(pmoToken, '/catalogs/projectMemberRoles', {
    method: 'PATCH',
    body: JSON.stringify([
      ...pmoSnap.catalogs.projectMemberRoles,
      { value: 'E2E_ROLE', label: 'E2E Test Role' },
    ]),
  })
  if (!cat.catalogs.projectMemberRoles.some((c) => c.value === 'E2E_ROLE'))
    throw new Error('catalog not updated')
  console.log('  ✓ catalog update confirmed')

  console.log('\n[9] Reset demo data (PMO)')
  step('POST /admin/reset-demo-data')
  const reset = await api<Snapshot>(pmoToken, '/admin/reset-demo-data', { method: 'POST' })
  console.log(`  ✓ reset complete — ${reset.projects.length} projects, ${reset.planItems.length} plan items`)

  console.log('\n✅ All E2E checks passed.')
}

main()
  .catch((err) => {
    console.error('❌ E2E failed:', err.message)
    process.exit(1)
  })
  .finally(() => sb.auth.signOut())
