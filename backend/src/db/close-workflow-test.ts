// E2E for the v3.2 close workflow (updated BA 14/05/2026: stage-2 = TCHC).
// Server must be running on :4000 + DB seeded.
//   1. PMO logs in, picks pm.an's project
//   2. PM pauses → assert PAUSED
//   3. PM resumes → assert ACTIVE
//   4. PM submits close request → KSV (dev.duy) sees in inbox
//   5. KSV approves → TCHC (hc.hoa = ADMIN_HC) sees in inbox
//   6. TCHC approves → project CLOSED
//   7. Try to PATCH closed project's summary → 423
//   8. Reset demo data
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
const API = `http://localhost:${process.env.PORT ?? 4000}/api`

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

interface Snap {
  currentUser: { id: string; username: string }
  users: { id: string; username: string }[]
  projects: { id: string; code: string; status: string; adminId: string }[]
}
interface Inbox {
  items: { id: string; projectId: string; ksvDecision: string; tchcDecision: string; project: { code: string } }[]
}

async function main() {
  console.log('▶ close-workflow E2E')

  console.log('\n[1] PMO loads snapshot')
  const pmo = await login('sys.chau@qlda.local')
  const pmoSnap = await api<Snap>(pmo, '/snapshot')

  // Pick a project pm.an admins.
  const pmAnId = pmoSnap.users.find((u) => u.username === 'pm.an')!.id
  const proj = pmoSnap.projects.find((p) => p.adminId === pmAnId)!
  console.log(`  using ${proj.code} (admin=pm.an, status=${proj.status})`)

  const pmAn = await login('pm.an@qlda.local')

  console.log('\n[2] PM pauses')
  let snap = await api<Snap>(pmAn, `/projects/${proj.id}/pause`, { method: 'POST' })
  if (snap.projects.find((p) => p.id === proj.id)?.status !== 'PAUSED') throw new Error('not PAUSED')
  console.log('  ✓ PAUSED')

  console.log('\n[3] PM resumes')
  snap = await api<Snap>(pmAn, `/projects/${proj.id}/resume`, { method: 'POST' })
  if (snap.projects.find((p) => p.id === proj.id)?.status !== 'ACTIVE') throw new Error('not ACTIVE')
  console.log('  ✓ ACTIVE')

  console.log('\n[4] PM submits close request')
  const closeRes = (await api<{ closeRequestId: string } & Snap>(
    pmAn,
    `/projects/${proj.id}/close-requests`,
    { method: 'POST', body: JSON.stringify({ note: 'Done with delivery' }) },
  )).closeRequestId
  console.log(`  ✓ requestId=${closeRes}`)

  console.log('\n[5] KSV (dev.duy) sees inbox + approves')
  const ksv = await login('dev.duy@qlda.local')
  const ksvInbox = await api<Inbox>(ksv, '/close-inbox')
  if (!ksvInbox.items.find((i) => i.id === closeRes)) throw new Error('KSV inbox missing the request')
  await api<Snap>(ksv, `/projects/${proj.id}/close-requests/${closeRes}/ksv`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'APPROVED' }),
  })
  console.log('  ✓ KSV approved')

  console.log('\n[6] TCHC (hc.hoa = ADMIN_HC) sees inbox + approves → CLOSED')
  const tchc = await login('hc.hoa@qlda.local')
  const tchcInbox = await api<Inbox>(tchc, '/close-inbox')
  if (!tchcInbox.items.find((i) => i.id === closeRes)) throw new Error('TCHC inbox missing the request')
  snap = await api<Snap>(tchc, `/projects/${proj.id}/close-requests/${closeRes}/tchc`, {
    method: 'PATCH',
    body: JSON.stringify({ decision: 'APPROVED' }),
  })
  if (snap.projects.find((p) => p.id === proj.id)?.status !== 'CLOSED') throw new Error('not CLOSED')
  console.log('  ✓ CLOSED')

  console.log('\n[7] Try to edit closed project — should 423')
  try {
    await api(pmo, `/projects/${proj.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ patch: { summary: 'should fail' } }),
    })
    throw new Error('PATCH succeeded but should have been blocked')
  } catch (err) {
    const m = (err as Error).message
    if (!m.includes('423')) throw new Error(`expected 423, got: ${m}`)
    console.log('  ✓ 423 Locked')
  }

  console.log('\n[8] Reset demo data')
  await api<Snap>(pmo, '/admin/reset-demo-data', { method: 'POST' })
  console.log('  ✓ reset')

  console.log('\n✅ close-workflow checks passed.')
}

main()
  .catch((e) => {
    console.error('❌', e.message)
    process.exit(1)
  })
  .finally(() => sb.auth.signOut())
