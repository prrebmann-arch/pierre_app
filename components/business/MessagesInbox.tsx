'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Skeleton from '@/components/ui/Skeleton'
import styles from '@/styles/messages.module.css'

// ── Types ──
interface IgAccount {
  id: string
  user_id: string
  ig_user_id: string
  ig_username: string
  access_token: string
  page_id?: string
  page_access_token?: string
}

interface Conversation {
  id: string
  participant_ig_id: string
  participant_name: string
  last_message_text: string
  last_message_at: string | null
}

interface Message {
  id: string
  sender: string
  message_text: string
  sent_at: string | null
}

// ── Helpers ──
function timeAgo(date: string | null): string {
  if (!date) return ''
  const now = new Date()
  const d = new Date(date)
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60) return "a l'instant"
  if (diff < 3600) return Math.floor(diff / 60) + ' min'
  if (diff < 86400) return Math.floor(diff / 3600) + ' h'
  if (diff < 604800) return Math.floor(diff / 86400) + ' j'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function formatMsgTime(date: string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

const FB_APP_ID = '1305972064754138'
const FB_CONFIG_ID = '1379162567352838'

export default function MessagesInbox() {
  const { user } = useAuth()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [account, setAccount] = useState<IgAccount | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [msgText, setMsgText] = useState('')
  const [sending, setSending] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── Load IG account ──
  const loadAccount = useCallback(async () => {
    if (!user) return null
    const { data } = await supabase
      .from('ig_accounts')
      .select('*')
      .eq('user_id', user.id)
      .single()
    setAccount(data)
    return data
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load conversations from API ──
  const loadConversations = useCallback(async () => {
    if (!user) return []
    try {
      const resp = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'conversations', user_id: user.id }),
      })
      const data = await resp.json()
      if (data.error) {
        // API error
        return []
      }
      const convos: Conversation[] = (data.data || []).map((c: Record<string, unknown>) => ({
        id: c.id as string,
        participant_ig_id: (c.participant_ig_id as string) || '',
        participant_name: (c.participant_name as string) || 'Inconnu',
        last_message_text: (c.last_message_text as string) || '',
        last_message_at: (c.last_message_at as string) || null,
      }))
      setConversations(convos)
      return convos
    } catch (err) {
      // fetch error
      return []
    }
  }, [user])

  // ── Load messages for a thread ──
  const loadMessages = useCallback(async (threadId: string) => {
    if (!user) return
    try {
      const resp = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'thread', thread_id: threadId, user_id: user.id }),
      })
      const data = await resp.json()
      if (data.error) {
        // thread error
        setMessages([])
        return
      }
      const msgs: Message[] = (data.messages || []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        sender: (m.sender as string) || 'participant',
        message_text: (m.message_text as string) || '',
        sent_at: (m.sent_at as string) || null,
      }))
      setMessages(msgs)
    } catch (err) {
      // thread fetch error
      setMessages([])
    }
  }, [user])

  // ── Background sync ──
  const syncMessages = useCallback(async () => {
    const acct = account || (await loadAccount())
    if (!acct?.page_access_token || !acct?.ig_user_id || !user) return
    setSyncing(true)
    try {
      const resp = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          user_id: user.id,
          ig_user_id: acct.ig_user_id,
          page_id: acct.page_id,
          page_access_token: acct.page_access_token,
        }),
      })
      const data = await resp.json()
      if (data.success) {
        // sync done
        await loadConversations()
      }
    } catch (err) {
      // sync error
    } finally {
      setSyncing(false)
    }
  }, [account, loadAccount, loadConversations, user])

  // ── Select conversation ──
  const selectConversation = useCallback(async (id: string) => {
    setSelectedConvo(id)
    await loadMessages(id)
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }, [loadMessages])

  // ── Send message ──
  const sendMessage = useCallback(async () => {
    if (!msgText.trim() || !selectedConvo || !user || !account) return
    const convo = conversations.find(c => c.id === selectedConvo)
    if (!convo) return

    setSending(true)
    try {
      const resp = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          user_id: user.id,
          ig_user_id: account.ig_user_id,
          recipient_id: convo.participant_ig_id,
          message_text: msgText.trim(),
          access_token: account.page_access_token,
          conversation_id: selectedConvo,
        }),
      })
      const data = await resp.json()
      if (data.error) {
        toast(`Erreur envoi: ${data.error}`, 'error')
        return
      }
      setMsgText('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      await loadMessages(selectedConvo)
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      toast('Erreur envoi du message', 'error')
    } finally {
      setSending(false)
    }
  }, [msgText, selectedConvo, user, account, conversations, toast, loadMessages])

  // ── Facebook OAuth connect ──
  const connectFacebookPage = () => {
    const redirectUri = encodeURIComponent(window.location.origin + '/')
    const authUrl = `https://www.facebook.com/dialog/oauth?client_id=${FB_APP_ID}&redirect_uri=${redirectUri}&response_type=code&config_id=${FB_CONFIG_ID}&state=fb_page_auth`
    window.location.href = authUrl
  }

  // ── Disconnect ──
  const disconnect = async () => {
    if (!confirm('Deconnecter Facebook Messages ?') || !user) return
    await supabase.from('ig_accounts').update({
      page_id: null,
      page_access_token: null,
    }).eq('user_id', user.id)
    setAccount(null)
    setConversations([])
    setMessages([])
    setSelectedConvo(null)
    toast('Facebook Messages deconnecte', 'success')
  }

  // ── Init ──
  useEffect(() => {
    if (!user) return
    ;(async () => {
      setLoading(true)
      try {
        const acct = await loadAccount()
        if (acct?.page_access_token) {
          const convos = await loadConversations()
          if (!convos.length) {
            // Try sync if no local data
            await syncMessages()
          } else {
            // Background sync
            syncMessages()
          }
        }
      } finally {
        setLoading(false)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // Auto-select first convo
  useEffect(() => {
    if (conversations.length > 0 && !selectedConvo) {
      selectConversation(conversations[0].id)
    }
  }, [conversations, selectedConvo, selectConversation])

  // ── Render states ──
  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ marginBottom: 16 }}><Skeleton height={40} /></div>
        <Skeleton height={400} />
      </div>
    )
  }

  // Not connected to Instagram
  if (!account?.access_token) {
    return (
      <div className={styles.notConnected}>
        <i className="fab fa-instagram" style={{ fontSize: 32, marginBottom: 12, display: 'block', opacity: 0.3 }} />
        <p style={{ color: 'var(--text3)', fontSize: 13 }}>Connectez votre Instagram pour acceder aux messages.</p>
      </div>
    )
  }

  // Instagram connected but no Page token
  if (!account.page_access_token) {
    return (
      <div className={styles.notConnected}>
        <i className="fab fa-facebook" style={{ fontSize: 40, color: '#1877F2', marginBottom: 16, display: 'block' }} />
        <h3 style={{ margin: '0 0 8px', color: 'var(--text)' }}>Connecter Facebook pour les messages</h3>
        <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20, maxWidth: 400, marginLeft: 'auto', marginRight: 'auto' }}>
          Pour lire et repondre a tes DMs Instagram depuis l&apos;app, tu dois connecter ta Page Facebook liee a ton compte Instagram.
        </p>
        <Button variant="primary" onClick={connectFacebookPage}>
          <i className="fab fa-facebook" style={{ marginRight: 8 }} /> Connecter ma Page Facebook
        </Button>
      </div>
    )
  }

  // No conversations
  if (conversations.length === 0) {
    return (
      <div className={styles.notConnected}>
        <i className="fab fa-instagram" style={{ fontSize: 40, marginBottom: 16, display: 'block', opacity: 0.3 }} />
        <h3 style={{ color: 'var(--text)', margin: '0 0 8px' }}>En attente de messages</h3>
        <p style={{ fontSize: 13, color: 'var(--text3)', maxWidth: 400, margin: '0 auto' }}>
          Les nouveaux messages Instagram arriveront ici automatiquement.<br />
          Envoie ou recois un message sur Instagram pour commencer.
        </p>
        <Button variant="outline" size="sm" onClick={syncMessages} style={{ marginTop: 16 }} disabled={syncing}>
          <i className={`fas fa-sync-alt ${syncing ? 'fa-spin' : ''}`} /> Rafraichir
        </Button>
        <br />
        <Button variant="outline" size="sm" onClick={disconnect} style={{ marginTop: 12, opacity: 0.5 }}>
          <i className="fas fa-sign-out-alt" /> Deconnecter Facebook
        </Button>
      </div>
    )
  }

  // ── Filter conversations ──
  const filteredConvos = search
    ? conversations.filter(c =>
        c.participant_name.toLowerCase().includes(search.toLowerCase()) ||
        c.last_message_text.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  const selectedConvoData = conversations.find(c => c.id === selectedConvo)

  return (
    <div className={styles.container}>
      {/* Sidebar */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <input
            type="text"
            className={styles.search}
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className={styles.sidebarActions}>
            <button className={styles.sidebarBtn} onClick={syncMessages} title="Rafraichir" disabled={syncing}>
              <i className={`fas fa-sync-alt ${syncing ? 'fa-spin' : ''}`} />
            </button>
            <button className={styles.sidebarBtn} onClick={disconnect} title="Deconnecter" style={{ opacity: 0.5 }}>
              <i className="fas fa-sign-out-alt" />
            </button>
          </div>
        </div>
        <div className={styles.convoList}>
          {filteredConvos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)', fontSize: 12 }}>Aucune conversation</div>
          ) : (
            filteredConvos.map(c => {
              const isActive = selectedConvo === c.id
              const lastMsg = c.last_message_text.length > 40
                ? c.last_message_text.substring(0, 40) + '...'
                : c.last_message_text
              const initial = (c.participant_name || '?')[0].toUpperCase()
              return (
                <div
                  key={c.id}
                  className={`${styles.convoItem} ${isActive ? styles.convoItemActive : ''}`}
                  onClick={() => selectConversation(c.id)}
                >
                  <div className={styles.convoAvatar}>{initial}</div>
                  <div className={styles.convoInfo}>
                    <div className={styles.convoTop}>
                      <span className={styles.convoName}>{c.participant_name || 'Inconnu'}</span>
                      <span className={styles.convoTime}>{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div className={styles.convoPreview}>{lastMsg}</div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Thread */}
      <div className={styles.thread}>
        {!selectedConvo ? (
          <div className={styles.empty}>
            <div>
              <i className="fas fa-comments" style={{ fontSize: 28, marginBottom: 10, display: 'block', opacity: 0.25 }} />
              Selectionne une conversation
            </div>
          </div>
        ) : (
          <>
            <div className={styles.threadHeader}>
              <div className={styles.convoAvatar}>
                {(selectedConvoData?.participant_name || '?')[0].toUpperCase()}
              </div>
              <div className={styles.threadName}>
                {selectedConvoData?.participant_name || 'Inconnu'}
              </div>
            </div>
            <div className={styles.messages}>
              {messages.length === 0 ? (
                <div className={styles.empty}><div>Aucun message</div></div>
              ) : (
                messages.map(m => {
                  const isCoach = m.sender === 'coach'
                  return (
                    <div key={m.id} className={`${styles.bubbleRow} ${isCoach ? styles.bubbleRowCoach : styles.bubbleRowThem}`}>
                      <div className={`${styles.bubble} ${isCoach ? styles.bubbleCoach : styles.bubbleThem}`}>
                        <div>{m.message_text}</div>
                        <div className={styles.bubbleTime} style={{ textAlign: isCoach ? 'right' : 'left' }}>
                          {formatMsgTime(m.sent_at)}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <div className={styles.compose}>
              <textarea
                ref={textareaRef}
                className={styles.input}
                placeholder="Ecrire un message..."
                rows={1}
                value={msgText}
                onChange={e => {
                  setMsgText(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
              />
              <button className={styles.sendBtn} onClick={sendMessage} disabled={sending}>
                <i className={`fas ${sending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
