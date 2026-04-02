// Instagram Webhook — Receive messages in real-time and store in Supabase
const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
  // Webhook verification (GET)
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && process.env.IG_WEBHOOK_VERIFY_TOKEN && token === process.env.IG_WEBHOOK_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // Receive events (POST) — process THEN respond
  if (req.method === 'POST') {
    const body = req.body;
    console.log('[ig-webhook] Event received, entries:', (body.entry || []).length);

    try {
      const supabase = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );

      if (body.object === 'instagram' || body.object === 'page') {
        for (const entry of (body.entry || [])) {
          for (const event of (entry.messaging || [])) {
            const senderId = event.sender?.id;
            const recipientId = event.recipient?.id;
            const timestamp = event.timestamp;
            const message = event.message;

            // Skip non-message events (read receipts, etc)
            if (!message || !message.text || !senderId) {
              console.log('[ig-webhook] Skipping non-text event');
              continue;
            }

            const isEcho = message.is_echo === true;
            console.log('[ig-webhook] Message from:', senderId, 'to:', recipientId, 'echo:', isEcho);

            // Find the coach who owns this IG account
            let igAccount = null;

            // For echoes: sender is the coach's ig_user_id
            // For incoming: recipient is the coach's ig_user_id
            const coachIgId = isEcho ? senderId : recipientId;
            const participantIgId = isEcho ? recipientId : senderId;

            const { data: found, error: findErr } = await supabase
              .from('ig_accounts')
              .select('user_id, ig_user_id, page_id, page_access_token, access_token')
              .eq('ig_user_id', coachIgId)
              .maybeSingle();

            if (findErr) {
              console.error('[ig-webhook] DB lookup error:', findErr.message);
            }

            igAccount = found;

            // Also try the other ID if not found
            if (!igAccount) {
              const { data: found2 } = await supabase
                .from('ig_accounts')
                .select('user_id, ig_user_id, page_id, page_access_token, access_token')
                .eq('ig_user_id', participantIgId)
                .maybeSingle();
              if (found2) {
                igAccount = found2;
              }
            }

            console.log('[ig-webhook] igAccount:', igAccount ? `found user=${igAccount.user_id}` : 'NOT FOUND');

            if (!igAccount) continue;

            const coachUserId = igAccount.user_id;

            // Find or create conversation
            let { data: existingConvo, error: convoErr } = await supabase
              .from('ig_conversations')
              .select('id')
              .eq('user_id', coachUserId)
              .eq('participant_ig_id', participantIgId)
              .maybeSingle();

            if (convoErr) console.error('[ig-webhook] Convo lookup error:', convoErr.message);

            // Get participant name from API
            let participantName = null;
            try {
              const token = igAccount.page_access_token || igAccount.access_token;
              if (token && !isEcho) {
                const profileRes = await fetch(`https://graph.facebook.com/v25.0/${participantIgId}?fields=name,username&access_token=${token}`);
                const profileData = await profileRes.json();
                if (profileData.username) participantName = profileData.username;
                else if (profileData.name) participantName = profileData.name;
              }
            } catch (nameErr) {
              console.log('[ig-webhook] Name fetch failed:', nameErr.message);
            }

            let convoId;
            if (existingConvo) {
              convoId = existingConvo.id;
              const updateData = {
                last_message_text: message.text,
                last_message_at: new Date(timestamp).toISOString(),
                updated_at: new Date().toISOString(),
              };
              if (participantName) updateData.participant_name = participantName;
              const { error: updateErr } = await supabase.from('ig_conversations').update(updateData).eq('id', convoId);
              if (updateErr) console.error('[ig-webhook] Convo update error:', updateErr.message);
              console.log('[ig-webhook] Updated conversation:', convoId);
            } else {
              const { data: newConvo, error: insertErr } = await supabase.from('ig_conversations').insert({
                user_id: coachUserId,
                ig_thread_id: `${senderId}_${recipientId}`,
                participant_ig_id: participantIgId,
                participant_name: participantName || 'Inconnu',
                last_message_text: message.text,
                last_message_at: new Date(timestamp).toISOString(),
              }).select('id').single();

              if (insertErr) {
                console.error('[ig-webhook] Convo insert error:', insertErr.message);
                continue;
              }
              convoId = newConvo?.id;
              console.log('[ig-webhook] Created conversation:', convoId);
            }

            if (!convoId) {
              console.error('[ig-webhook] No convoId, skipping message insert');
              continue;
            }

            // Insert message (check duplicate)
            const msgId = message.mid || `wh_${timestamp}`;
            const { data: existingMsg } = await supabase
              .from('ig_messages')
              .select('id')
              .eq('ig_message_id', msgId)
              .maybeSingle();

            if (!existingMsg) {
              const { error: msgErr } = await supabase.from('ig_messages').insert({
                ig_message_id: msgId,
                conversation_id: convoId,
                sender: isEcho ? 'coach' : 'participant',
                message_text: message.text,
                message_type: 'text',
                sent_at: new Date(timestamp).toISOString(),
              });
              if (msgErr) {
                console.error('[ig-webhook] Message insert error:', msgErr.message);
              } else {
                console.log('[ig-webhook] Message saved');
              }
            } else {
              console.log('[ig-webhook] Duplicate message, skipped');
            }
          }
        }
      }
    } catch (err) {
      console.error('[ig-webhook] Processing error:', err.message);
    }

    // Respond AFTER processing
    return res.status(200).json({ received: true });
  }

  return res.status(405).send('Method not allowed');
};
