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
  for (const u of data.users) {
    console.log(
      `${u.email?.padEnd(28)} | id=${u.id} | confirmed=${!!u.email_confirmed_at} | last_sign_in=${u.last_sign_in_at ?? 'never'}`,
    )
  }
  console.log(`total: ${data.users.length}`)
})()
