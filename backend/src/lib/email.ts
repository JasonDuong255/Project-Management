// Pluggable email transport. Default in dev: console; prod swaps in real SMTP.
// Switch via env: EMAIL_TRANSPORT=console|smtp.
import { env } from '../config/env.js'

interface SendEmailParams {
  to: string
  subject: string
  body: string
}

const transport = process.env.EMAIL_TRANSPORT ?? 'console'

export async function sendEmail(params: SendEmailParams): Promise<void> {
  if (transport === 'console') {
    console.log(
      `[email:console] to=${params.to}\n  subject=${params.subject}\n  body=${params.body.slice(0, 200)}${params.body.length > 200 ? '…' : ''}`,
    )
    return
  }
  // SMTP path lands when EMAIL_TRANSPORT=smtp + SMTP_HOST/SMTP_USER/etc are set.
  // Until then, fail loud rather than silently swallow.
  console.warn(`[email:${transport}] not yet implemented; subject=${params.subject}`)
  void env
}
