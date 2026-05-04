import { createClient } from '@supabase/supabase-js'
import { jwtVerify } from 'jose'
import { env } from '../config/env.js'

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const jwtSecretKey = env.SUPABASE_JWT_SECRET
  ? new TextEncoder().encode(env.SUPABASE_JWT_SECRET)
  : null

export interface SupabaseJwtPayload {
  sub: string
  email?: string
  role?: string
  exp?: number
  iat?: number
}

/**
 * Verify a Supabase access token.
 * - Fast path: local HS256 verify if SUPABASE_JWT_SECRET is configured.
 * - Fallback: call supabase.auth.getUser(token) which validates against the GoTrue server.
 */
export async function verifySupabaseAccessToken(token: string): Promise<SupabaseJwtPayload> {
  if (jwtSecretKey) {
    const { payload } = await jwtVerify(token, jwtSecretKey, { algorithms: ['HS256'] })
    if (typeof payload.sub !== 'string') {
      throw new Error('JWT missing subject claim')
    }
    return payload as unknown as SupabaseJwtPayload
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) {
    throw new Error(error?.message ?? 'Unable to validate token')
  }
  return {
    sub: data.user.id,
    email: data.user.email ?? undefined,
    role: data.user.role ?? undefined,
  }
}
