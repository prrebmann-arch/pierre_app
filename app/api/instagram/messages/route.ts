// Instagram Messaging API — Read from Supabase, send via Instagram Graph API
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCoach, authErrorResponse } from '@/lib/api/auth';
import { getCorsHeaders, handlePreflight } from '@/lib/api/cors';

// Cached Supabase admin client (service role — persists across requests in same lambda)
let _supabaseAdmin: ReturnType<typeof createClient> | null = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) _supabaseAdmin = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  return _supabaseAdmin;
}

export const maxDuration = 60;

export async function OPTIONS(request: Request) {
  return handlePreflight(request);
}

export async function POST(request: Request) {
  const corsHeaders = getCorsHeaders(request);
  const body = await request.json();

  try { await verifyCoach(request, body, 'user_id'); } catch (e) { return authErrorResponse(e, corsHeaders); }

  const supabase = getSupabaseAdmin();

  const BASE = 'https://graph.facebook.com/v25.0';

  try {
    const { action, user_id } = body;

    // --- READ CONVERSATIONS FROM SUPABASE (instant) ---
    if (action === 'conversations') {
      const { data, error } = await supabase
        .from('ig_conversations')
        .select('*')
        .eq('user_id', user_id)
        .order('last_message_at', { ascending: false });

      if (error) {
        console.error('[ig-messages] Supabase error:', error);
        return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
      }
      return NextResponse.json({ data: data || [] }, { headers: corsHeaders });
    }

    // --- READ THREAD FROM SUPABASE (instant) ---
    if (action === 'thread') {
      const { thread_id } = body;
      const { data, error } = await supabase
        .from('ig_messages')
        .select('*')
        .eq('conversation_id', thread_id)
        .order('sent_at', { ascending: true });

      if (error) {
        console.error('[ig-messages] Supabase thread error:', error);
        return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
      }
      return NextResponse.json({ messages: data || [] }, { headers: corsHeaders });
    }

    // --- SEND MESSAGE VIA INSTAGRAM API ---
    if (action === 'send') {
      const { recipient_id, message_text, access_token, ig_user_id, conversation_id } = body;
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
        return NextResponse.json({ error: sendData.error.message }, { status: 400, headers: corsHeaders });
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
        } as never);

        await supabase.from('ig_conversations').update({
          last_message_text: message_text,
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', conversation_id);
      }

      return NextResponse.json({ success: true, message_id: sendData.message_id }, { headers: corsHeaders });
    }

    // --- SYNC: refresh messages for existing conversations in Supabase ---
    if (action === 'sync') {
      const { ig_user_id, page_access_token } = body;
      if (!user_id || !page_access_token) {
        return NextResponse.json({ error: 'Missing user_id or page_access_token' }, { status: 400, headers: corsHeaders });
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
            const otherPerson = msgs.find((m: { from?: { id?: string } }) => m.from?.id && m.from.id !== ig_user_id);
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

            // Batch check existing messages instead of N+1 queries
            const msgIds = msgs.map((m: { id: string }) => m.id);
            const { data: existingMsgs } = await supabase
              .from('ig_messages')
              .select('ig_message_id')
              .in('ig_message_id', msgIds);
            const existingSet = new Set((existingMsgs || []).map((e: { ig_message_id: string }) => e.ig_message_id));

            const newMsgs = msgs.filter((m: { id: string }) => !existingSet.has(m.id));
            if (newMsgs.length > 0) {
              await supabase.from('ig_messages').insert(
                newMsgs.map((m: { id: string; from?: { id?: string }; message?: string; created_time?: string }) => ({
                  ig_message_id: m.id,
                  conversation_id: conv.id,
                  sender: m.from?.id === ig_user_id ? 'coach' : 'participant',
                  message_text: m.message || '',
                  message_type: 'text',
                  sent_at: m.created_time,
                })) as never
              );
              syncedMessages += newMsgs.length;
            }
          } catch (err: unknown) {
            console.error('[ig-sync] Error for conv', conv.id, (err as Error).message);
          }
        }
      }

      console.log('[ig-sync] Refreshed, new messages:', syncedMessages);
      return NextResponse.json({
        success: true,
        messages: syncedMessages,
        info: localConvos?.length ? 'Refreshed existing conversations' : 'No conversations yet — send/receive a message on Instagram to start',
      }, { headers: corsHeaders });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400, headers: corsHeaders });
  } catch (err: unknown) {
    console.error('[ig-messages] Unexpected error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500, headers: corsHeaders });
  }
}
