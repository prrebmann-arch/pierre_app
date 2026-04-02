// ===== EXPO PUSH NOTIFICATIONS =====

/**
 * Send push notification via Expo Push API.
 * Silently fails if no tokens found (athlete hasn't opened mobile app yet).
 * @param {string[]} userIds - Supabase auth user IDs
 * @param {string} title
 * @param {string} body
 * @param {object} data - optional payload
 */
async function sendExpoPush(userIds, title, body, data = {}) {
  try {
    const { data: tokens } = await supabaseClient
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    devLog('[Push] tokens found:', tokens?.length, 'for userIds:', userIds);
    if (!tokens || tokens.length === 0) return;

    const messages = tokens.map(t => ({
      to: t.token,
      sound: 'default',
      title,
      body,
      data
    }));

    const resp = await authFetch('/api/push', {
      method: 'POST',
      body: JSON.stringify(messages),
    });

    if (!resp.ok) {
      const err = await resp.text();
      devError('[Push] Expo API error:', err);
    }

    devLog('[Push]', `Sent to ${tokens.length} token(s) for ${userIds.length} user(s)`);
  } catch (err) {
    devError('[Push] Failed:', err);
  }
}

/**
 * Insert in-app notification + send push in one call.
 * @param {string} userId - Supabase auth user ID
 * @param {string} type - notification type (training, nutrition, retour, rappel, message)
 * @param {string} title
 * @param {string} body
 * @param {object} metadata - optional metadata for in-app notification
 */
async function notifyAthlete(userId, type, title, body, metadata = {}) {
  // 1. In-app notification (DB)
  await supabaseClient.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body,
    metadata
  });
  // 2. Push notification (Expo)
  await sendExpoPush([userId], title, body, { type, ...metadata });
}
