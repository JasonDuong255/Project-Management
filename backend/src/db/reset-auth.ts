// One-time: delete all Supabase auth users so the seed can recreate them with
// synthesized @qlda.local emails. Use only in dev / demo.
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const s = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
)

;(async () => {
  const { data, error } = await s.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) {
    console.error(error)
    process.exit(1)
  }
  console.log(`Deleting ${data.users.length} auth users…`)
  for (const u of data.users) {
    const { error: delErr } = await s.auth.admin.deleteUser(u.id)
    if (delErr) console.warn(`  ${u.email}: ${delErr.message}`)
    else console.log(`  ✓ ${u.email}`)
  }
  console.log('done.')
})()
