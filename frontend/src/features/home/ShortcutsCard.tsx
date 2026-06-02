import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import { useAuth } from '@/context/AuthContext'
import { APP_REGISTRY } from '@/config/features'
import './shortcuts-card.css'

const ICONS: Record<string, React.ReactNode> = {
  House:           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Users:           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
  Contact:         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  FolderKanban:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 002-2V8a2 2 0 00-2-2h-7.93a2 2 0 01-1.66-.9l-.82-1.2A2 2 0 007.93 3H4a2 2 0 00-2 2v13c0 1.1.9 2 2 2z"/></svg>,
  FileText:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  ShieldCheck:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  ShieldAlert:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  LayoutDashboard: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  TrendingUp:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  PiggyBank:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2V5z"/><path d="M2 9v1a2 2 0 002 2h1"/><path d="M16 11h.01"/></svg>,
  TrendingDown:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Wallet:          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12V7H5a2 2 0 010-4h14v4"/><path d="M3 5v14a2 2 0 002 2h16v-5"/><path d="M18 12a2 2 0 000 4h4v-4z"/></svg>,
  Building2:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22V4a2 2 0 012-2h8a2 2 0 012 2v18z"/><path d="M6 12H4a2 2 0 00-2 2v6a2 2 0 002 2h2"/><path d="M18 9h2a2 2 0 012 2v9a2 2 0 01-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/></svg>,
  BarChart2:       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  Landmark:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>,
  CreditCard:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
}

const ICON_COLORS = [
  { bg: '#fff3ec', color: '#e8621a' },
  { bg: '#eff6ff', color: '#3b82f6' },
  { bg: '#f0fdf4', color: '#22c55e' },
  { bg: '#fdf4ff', color: '#a855f7' },
  { bg: '#fff7ed', color: '#f97316' },
  { bg: '#f0f9ff', color: '#0ea5e9' },
  { bg: '#fef2f2', color: '#ef4444' },
]

function Icon({ name, colorIdx = 0 }: { name: string; colorIdx?: number }) {
  const c = ICON_COLORS[colorIdx % ICON_COLORS.length]
  return (
    <span className="sc-icon" style={{ background: c.bg, color: c.color }}>
      {ICONS[name] ?? ICONS.FileText}
    </span>
  )
}

interface ShortcutDef {
  id: string; label: string; href: string; icon: string; group: string
}

function buildAllShortcuts(can: (id: string) => boolean, hasAnyEnc: boolean): ShortcutDef[] {
  const result: ShortcutDef[] = []
  for (const item of APP_REGISTRY.standalone) {
    if (item.id === 'home') continue
    if (can(item.id)) result.push({ id: item.id, label: item.label, href: item.href, icon: item.icon, group: 'Général' })
  }
  for (const group of APP_REGISTRY.groups) {
    for (const feat of group.features) {
      const accessible = feat.id === 'encaissements-overview' ? hasAnyEnc : can(feat.id)
      if (accessible) result.push({ id: feat.id, label: feat.label, href: feat.href, icon: feat.icon, group: group.label })
    }
  }
  return result
}

function storageKey(userId: string) { return `shortcuts_${userId}` }
function loadShortcuts(userId: string): string[] {
  try { const raw = localStorage.getItem(storageKey(userId)); return raw ? JSON.parse(raw) : [] } catch { return [] }
}
function saveShortcuts(userId: string, ids: string[]) {
  try { localStorage.setItem(storageKey(userId), JSON.stringify(ids)) } catch {}
}

export default function ShortcutsCard() {
  const { user, can } = useAuth()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeIds,  setActiveIds]  = useState<string[]>([])
  const [mounted,    setMounted]    = useState(false)
  const [pickerPos,  setPickerPos]  = useState({ top: 0, right: 0 })
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const addBtnRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const dragId    = useRef<string | null>(null)

  const hasAnyEnc    = can('encaissements-factures') || can('encaissements-autres-revenus')
  const allShortcuts = buildAllShortcuts(can, hasAnyEnc)

  useEffect(() => {
    setMounted(true)
    if (user?.id) setActiveIds(loadShortcuts(user.id))
  }, [user?.id])

  useEffect(() => {
    if (!pickerOpen) return
    function onDown(e: MouseEvent) {
      if (
        pickerRef.current && !pickerRef.current.contains(e.target as Node) &&
        addBtnRef.current && !addBtnRef.current.contains(e.target as Node)
      ) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [pickerOpen])

  function openPicker() {
    if (addBtnRef.current) {
      const r = addBtnRef.current.getBoundingClientRect()
      setPickerPos({ top: r.bottom + window.scrollY + 8, right: window.innerWidth - r.right })
    }
    setPickerOpen(o => !o)
  }

  const MAX = 4

  function toggle(id: string) {
    if (!activeIds.includes(id) && activeIds.length >= MAX) return
    const next = activeIds.includes(id) ? activeIds.filter(i => i !== id) : [...activeIds, id]
    setActiveIds(next)
    if (user?.id) saveShortcuts(user.id, next)
  }

  function reorder(targetId: string) {
    const from = dragId.current
    if (!from || from === targetId) return
    const next = [...activeIds]
    const fromIdx = next.indexOf(from)
    const toIdx   = next.indexOf(targetId)
    if (fromIdx < 0 || toIdx < 0) return
    next.splice(fromIdx, 1)
    next.splice(toIdx, 0, from)
    setActiveIds(next)
    if (user?.id) saveShortcuts(user.id, next)
  }

  const activeShortcuts = activeIds
    .map(id => allShortcuts.find(s => s.id === id))
    .filter((s): s is ShortcutDef => Boolean(s))
  const groups = Array.from(new Set(allShortcuts.map(s => s.group)))

  if (!mounted) return null

  return (
    <div className="sc-card">
      {/* Header */}
      <div className="sc-header">
        <div className="sc-header-left">
          <svg className="sc-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <span className="sc-title">Raccourcis</span>
          {activeShortcuts.length > 0 && <span className="sc-count">{activeShortcuts.length}</span>}
        </div>
        <button ref={addBtnRef} className="sc-add-btn" onClick={openPicker}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter
        </button>
      </div>

      {/* Shortcuts grid */}
      {activeShortcuts.length === 0 ? (
        <div className="sc-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
          <p>Aucun raccourci</p>
          <span className="sc-empty-hint">Cliquez sur + Ajouter pour personnaliser</span>
        </div>
      ) : (
        <div className="sc-grid">
          {activeShortcuts.map((s, i) => (
            <Link
              key={s.id}
              to={s.href}
              className={`sc-tile${dragOverId === s.id ? ' sc-tile--dragover' : ''}`}
              draggable
              onDragStart={(e) => { dragId.current = s.id; e.dataTransfer.effectAllowed = 'move' }}
              onDragOver={(e) => { e.preventDefault(); if (dragOverId !== s.id) setDragOverId(s.id) }}
              onDragLeave={() => setDragOverId(prev => (prev === s.id ? null : prev))}
              onDrop={(e) => { e.preventDefault(); reorder(s.id); setDragOverId(null); dragId.current = null }}
              onDragEnd={() => { setDragOverId(null); dragId.current = null }}
            >
              <Icon name={s.icon} colorIdx={i} />
              <span className="sc-tile-label">{s.label}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Picker portal */}
      {mounted && createPortal(
        <AnimatePresence>
          {pickerOpen && (
            <motion.div
              ref={pickerRef}
              className="sc-picker-card"
              style={{ top: pickerPos.top, right: pickerPos.right }}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            >
              <div className="sc-picker-header">
                <span className="sc-picker-title">Choisir des raccourcis</span>
                <button className="sc-picker-close" onClick={() => setPickerOpen(false)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
              <div className="sc-picker-body">
                {groups.map(group => {
                  const items = allShortcuts.filter(s => s.group === group)
                  return (
                    <div key={group} className="sc-picker-group">
                      <div className="sc-picker-group-label">{group}</div>
                      <div className="sc-picker-items">
                        {items.map((s, i) => {
                          const active = activeIds.includes(s.id)
                          const disabled = !active && activeIds.length >= MAX
                          return (
                            <button
                              key={s.id}
                              className={`sc-picker-item${active ? ' sc-picker-item--active' : ''}${disabled ? ' sc-picker-item--disabled' : ''}`}
                              onClick={() => toggle(s.id)}
                              disabled={disabled}
                            >
                              <Icon name={s.icon} colorIdx={i} />
                              <span className="sc-picker-item-label">{s.label}</span>
                              <span className="sc-picker-check">
                                {active
                                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                }
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="sc-picker-footer">
                <span className={`sc-picker-count${activeIds.length >= MAX ? ' sc-picker-count--max' : ''}`}>
                  {activeIds.length}/{MAX} sélectionnés
                </span>
                <button className="sc-picker-done" onClick={() => setPickerOpen(false)}>Terminé</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
