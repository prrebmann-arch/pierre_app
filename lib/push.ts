import { createClient } from '@/lib/supabase/client'

/**
 * Send push notification via Expo Push API + insert in-app notification.
 * Mirrors the original js/push.js notifyAthlete() function.
 */
export async function notifyAthlete(
  userId: string,
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown> = {}
) {
  const supabase = createClient()

  // 1. In-app notification (DB)
  await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    meta: metadata,
  })

  // 2. Push notification (Expo)
  await sendExpoPush([userId], title, body, { type, ...metadata })
}

/**
 * Send push notifications via Expo Push API.
 * Silently fails if no tokens found (athlete hasn't opened mobile app yet).
 */
export async function sendExpoPush(
  userIds: string[],
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    if (!userIds.length) return

    const supabase = createClient()
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds)

    if (!tokens || tokens.length === 0) return

    const messages = tokens.map((t: { token: string }) => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data,
    }))

    const resp = await fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    })

    if (!resp.ok) {
      console.error('[Push] Expo API error:', await resp.text())
    }
  } catch (err) {
    console.error('[Push] Failed:', err)
  }
}
