// Instagram Messaging API — Read from Supabase, send via Instagram Graph API
const { createClient } = require('@supabase/supabase-js');
const { verifyCoach, handleAuthError } = require('./_auth');
const { cors } = require('./_cors');

module.exports = async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: verify JWT + user_id ownership
  try { await verifyCoach(req, 'user_id'); } catch (e) { return handleAuthError(res, e); }

  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const BASE = 'https://graph.facebook.com/v25.0';

  try {
    const { action, user_id } = req.body;

    // --- READ CONVERSATIONS FROM SUPABASE (instant) ---
    if (action === 'conversations') {
      const { data, error } = await supabase
        .from('ig_conversations')
        .select('*')
        .eq('user_id', user_id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('[ig-messages] Supabase error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({ data: data || [] });
    }

    // --- READ THREAD FROM SUPABASE (instant) ---
    if (action === 'thread') {
      const { thread_id } = req.body;
      const { data, error } = await supabase
        .from('ig_messages')
        .select('*')
        .eq('conversation_id', thread_id)
        .order('sent_at', { ascending: true });

      if (error) {
        console.error('[ig-messages] Supabase thread error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(200).json({ messages: data || [] });
    }

    // --- SEND MESSAGE VIA INSTAGRAM API ---
    if (action === 'send') {
      const { recipient_id, message_text, access_token, ig_user_id, conversation_id } = req.body;
      const sendRes = await fetch(`${BASE}/me/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipient_id },
          message: { text: message_text },
          access_token,
        }),
      });
      const sendData = await sendRes.json();
      if (sendData.error) {
        console.error('[ig-messages] Send error:', JSON.stringify(sendData.error));
        return res.status(400).json({ error: sendData.error.message });
      }

      // Save sent message to Supabase
      if (conversation_id) {
        await supabase.from('ig_messages').insert({
          ig_message_id: sendData.message_id || `sent_${Date.now()}`,
          conversation_id,
          sender: 'coach',
          message_text,
          message_type: 'text',
          sent_at: new Date().toISOString(),
        });

        await supabase.from('ig_conversations').update({
          last_message_text: message_text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', conversation_id);
      }

      return res.status(200).json({ success: true, message_id: sendData.message_id });
    }

    // --- SYNC: refresh messages for existing conversations in Supabase ---
    if (action === 'sync') {
      const { ig_user_id, page_access_token } = req.body;
      if (!user_id || !page_access_token) {
        return res.status(400).json({ error: 'Missing user_id or page_access_token' });
      }

      // Get existing conversations from Supabase
      const { data: localConvos } = await supabase
        .from('ig_conversations')
        .select('id, ig_thread_id')
        .eq('user_id', user_id)
        .order('last_message_at', { ascending: false })
        .limit(10);

      let syncedMessages = 0;

      // If we have local conversations, refresh their messages
      if (localConvos && localConvos.length > 0) {
        for (const conv of localConvos) {
          try {
            const threadId = conv.ig_thread_id || conv.id;
            const msgFields = encodeURIComponent('messages.limit(10){message,from,created_time}');
            const threadUrl = `${BASE}/${threadId}?fields=${msgFields}&access_token=${page_access_token}`;
            const threadRes = await fetch(threadUrl);
            const threadData = await threadRes.json();

            if (threadData.error) {
              console.log('[ig-sync] Thread skip:', threadId, threadData.error.message);
              continue;
            }

            const msgs = threadData.messages?.data || [];
            const otherPerson = msgs.find(m => m.from?.id && m.from.id !== ig_user_id);
            const lastMsg = msgs[0];

            if (lastMsg) {
              await supabase.from('ig_conversations').update({
                participant_name: otherPerson?.from?.name || undefined,
                participant_ig_id: otherPerson?.from?.id || undefined,
                last_message_text: lastMsg.message || '',
                last_message_at: lastMsg.created_time,
                updated_at: new Date().toISOString(),
              }).eq('id', conv.id);
            }

            for (const m of msgs) {
              const { data: existing } = await supabase
                .from('ig_messages')
                .select('id')
                .eq('ig_message_id', m.id)
                .maybeSingle();

              if (!existing) {
                await supabase.from('ig_messages').insert({
                  ig_message_id: m.id,
                  conversation_id: conv.id,
                  sender: m.from?.id === ig_user_id ? 'coach' : 'participant',
                  message_text: m.message || '',
                  message_type: 'text',
                  sent_at: m.created_time,
                });
                syncedMessages++;
              }
            }
          } catch (err) {
            console.error('[ig-sync] Error for conv', conv.id, err.message);
          }
        }
      }

      console.log('[ig-sync] Refreshed, new messages:', syncedMessages);
      return res.status(200).json({
        success: true,
        messages: syncedMessages,
        info: localConvos?.length ? 'Refreshed existing conversations' : 'No conversations yet — send/receive a message on Instagram to start',
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('[ig-messages] Unexpected error:', err);
    return res.status(500).json({ error: err.message });
  }
};
