import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import './notifications-card.css'

interface Notification {
  id: string
  title: string
  body?: string
  type?: 'info' | 'success' | 'warning' | 'error'
  link?: string
  readAt?: string | null
  createdAt: string
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "à l'instant"
  if (m < 60) return `il y a ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  return `il y a ${d} j`
}

function dotClass(type?: string) {
  switch (type) {
    case 'success': return 'nc-dot--success'
    case 'warning': return 'nc-dot--warning'
    case 'error':   return 'nc-dot--error'
    default:        return 'nc-dot--info'
  }
}

export default function NotificationsCard() {
  const [notifs,  setNotifs]  = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    try {
      const { data } = await api.get<Notification[]>('/api/notifications')
      setNotifs(data)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [fetch])

  const unread = notifs.filter(n => !n.readAt)

  async function markRead(id: string) {
    try {
      await api.post(`/api/notifications/${id}/read`)
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    } catch {}
  }

  async function markAll() {
    try {
      await api.post('/api/notifications/read-all')
      setNotifs(prev => prev.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
    } catch {}
  }

  return (
    <div className="nc-card">
      <div className="nc-header">
        <div className="nc-header-left">
          <svg className="nc-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <span className="nc-title">Notifications</span>
          {unread.length > 0 && <span className="nc-count">{unread.length}</span>}
        </div>
        {unread.length > 0 && (
          <button className="nc-mark-all-btn" onClick={markAll}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Tout lire
          </button>
        )}
      </div>

      {loading ? (
        <div className="nc-empty">
          <div className="nc-spinner" />
        </div>
      ) : notifs.length === 0 ? (
        <div className="nc-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 01-3.46 0"/>
          </svg>
          <p>Aucune notification</p>
          <span className="nc-empty-hint">Vous êtes à jour !</span>
        </div>
      ) : (
        <div className="nc-list">
          {notifs.map(n => {
            const isUnread = !n.readAt
            const content = (
              <>
                <div className={`nc-dot ${dotClass(n.type)}`} />
                <div className="nc-item-content">
                  <p className="nc-item-title">{n.title}</p>
                  <span className="nc-item-time">{timeAgo(n.createdAt)}</span>
                </div>
                {isUnread && <div className="nc-unread-dot" />}
              </>
            )

            if (n.link) {
              return (
                <a
                  key={n.id}
                  href={n.link}
                  className={`nc-item nc-item--link${isUnread ? ' nc-item--unread' : ''}`}
                  onClick={() => { if (isUnread) markRead(n.id) }}
                >
                  {content}
                </a>
              )
            }

            return (
              <div
                key={n.id}
                className={`nc-item${isUnread ? ' nc-item--unread' : ''}`}
                onClick={() => { if (isUnread) markRead(n.id) }}
                style={isUnread ? { cursor: 'pointer' } : undefined}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
