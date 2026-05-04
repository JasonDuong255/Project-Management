// Smoke-test: log in as a demo user via Supabase, call /api/snapshot, verify counts.
// Usage: npx tsx src/db/smoke-test.ts
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { env } from '../config/env.js'

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
const API = `http://localhost:${env.PORT}`

async function loginAndSnapshot(email: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: '123456' })
  if (error || !data.session) {
    throw new Error(`login failed for ${email}: ${error?.message}`)
  }
  const res = await fetch(`${API}/api/snapshot`, {
    headers: { Authorization: `Bearer ${data.session.access_token}` },
  })
  if (!res.ok) throw new Error(`snapshot ${res.status}: ${await res.text()}`)
  const snap = (await res.json()) as {
    currentUser: { username: string; role: string }
    projects: unknown[]
    planItems: unknown[]
    worklogs: unknown[]
  }
  console.log(
    `${email.padEnd(28)} role=${snap.currentUser.role.padEnd(16)} ` +
      `projects=${snap.projects.length} planItems=${snap.planItems.length} worklogs=${snap.worklogs.length}`,
  )
  await supabase.auth.signOut()
}

async function main() {
  await loginAndSnapshot('sys.chau@qlda.local') // PMO — sees all
  await loginAndSnapshot('hc.hoa@qlda.local') // ADMIN_HC — sees all
  await loginAndSnapshot('pm.an@qlda.local') // PM — only own
  await loginAndSnapshot('dev.binh@qlda.local') // DELIVERY_MEMBER — only member
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
