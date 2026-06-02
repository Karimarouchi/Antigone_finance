import * as React from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Check, Pencil, Trash2 } from 'lucide-react'
import {
  format, addMonths, subMonths, isSameDay, isToday,
  getDate, getDaysInMonth, startOfMonth,
} from 'date-fns'
import { fr } from 'date-fns/locale'
import { motion, AnimatePresence } from 'motion/react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CalendarEntry {
  id:         string
  user_id:    string
  date:       string        // 'yyyy-MM-dd'
  title:      string
  note:       string | null
  color:      string
  created_at: string
}

interface GlassCalendarProps extends React.HTMLAttributes<HTMLDivElement> {
  entries:  CalendarEntry[]
  onAdd:    (date: Date, title: string, note: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, title: string, note: string, color: string) => Promise<void>
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLORS = ['#e8621a', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#f59e0b']

// ── Component ─────────────────────────────────────────────────────────────────

export function GlassCalendar({ className, entries, onAdd, onDelete, onUpdate, style, ...props }: GlassCalendarProps) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = React.useState(today)
  const [selectedDate, setSelectedDate] = React.useState(today)
  const [adding,    setAdding]    = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [title,     setTitle]     = React.useState('')
  const [note,      setNote]      = React.useState('')
  const [color,     setColor]     = React.useState(COLORS[0])
  const [saving,    setSaving]    = React.useState(false)
  const titleRef  = React.useRef<HTMLInputElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  const monthDays = React.useMemo(() => {
    const start     = startOfMonth(currentMonth)
    const totalDays = getDaysInMonth(currentMonth)
    return Array.from({ length: totalDays }, (_, i) => {
      const date    = new Date(start.getFullYear(), start.getMonth(), i + 1)
      const dateStr = format(date, 'yyyy-MM-dd')
      const entry   = entries.find(e => e.date === dateStr)
      return { date, isToday: isToday(date), isSelected: isSameDay(date, selectedDate), hasEntry: !!entry, entryColor: entry?.color ?? null }
    })
  }, [currentMonth, selectedDate, entries])

  const selectedStr = format(selectedDate, 'yyyy-MM-dd')
  const dayEntries  = entries.filter(e => e.date === selectedStr)

  React.useEffect(() => {
    if (!scrollRef.current) return
    const idx = monthDays.findIndex(d => d.isToday)
    if (idx >= 0) (scrollRef.current.children[idx] as HTMLElement | undefined)?.scrollIntoView({ inline: 'center', behavior: 'smooth' })
  }, [currentMonth]) // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (adding || editingId) setTimeout(() => titleRef.current?.focus(), 80)
  }, [adding, editingId])

  function openAdd() { setEditingId(null); setTitle(''); setNote(''); setColor(COLORS[0]); setAdding(true) }
  function openEdit(e: CalendarEntry) { setAdding(false); setTitle(e.title); setNote(e.note ?? ''); setColor(e.color); setEditingId(e.id) }
  function cancelForm() { setAdding(false); setEditingId(null) }

  async function handleSave() {
    if (!title.trim() || saving) return
    setSaving(true)
    if (editingId) { await onUpdate(editingId, title.trim(), note.trim(), color); setEditingId(null) }
    else           { await onAdd(selectedDate, title.trim(), note.trim(), color); setAdding(false) }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    await onDelete(id)
    if (editingId === id) setEditingId(null)
  }

  const showForm = adding || !!editingId

  return (
    <div className={`gc-card${className ? ` ${className}` : ''}`} style={style} {...props}>

      {/* ── Month header ── */}
      <div className="gc-header">
        <motion.p
          key={format(currentMonth, 'MMMM-yyyy')}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="gc-month-label"
        >
          {format(currentMonth, 'MMMM yyyy', { locale: fr })}
        </motion.p>
        <div className="gc-nav">
          <button className="gc-nav-btn" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft size={16} />
          </button>
          <button className="gc-nav-btn" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* ── Day strip ── */}
      <div className="gc-strip-wrap">
        <div ref={scrollRef} className="gc-strip">
          {monthDays.map(day => (
            <button
              key={format(day.date, 'yyyy-MM-dd')}
              onClick={() => { setSelectedDate(day.date); cancelForm() }}
              className={['gc-day', day.isSelected ? 'gc-day--selected' : '', day.isToday && !day.isSelected ? 'gc-day--today' : ''].filter(Boolean).join(' ')}
            >
              <span className="gc-day-name">{format(day.date, 'EEE', { locale: fr }).slice(0, 2)}</span>
              <span className="gc-day-num">{getDate(day.date)}</span>
              <span className="gc-dot" style={{ background: day.entryColor ?? 'transparent', opacity: day.hasEntry ? 1 : 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="gc-divider" />

      {/* ── Selected date row ── */}
      <div className="gc-date-row">
        <p className="gc-date-label">{format(selectedDate, 'EEEE d MMMM', { locale: fr })}</p>
        <button className="gc-add-btn" onClick={openAdd}><Plus size={13} /> Ajouter</button>
      </div>

      {/* ── Entry list ── */}
      <div className="gc-entries">
        <AnimatePresence initial={false}>
          {dayEntries.length === 0 && !showForm && (
            <motion.p key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="gc-empty">
              Aucune note pour cette journée
            </motion.p>
          )}
          {dayEntries.map(entry => (
            <motion.div key={entry.id} layout initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="gc-entry">
              <span className="gc-entry-dot" style={{ background: entry.color }} />
              <div className="gc-entry-body">
                <p className="gc-entry-title">{entry.title}</p>
                {entry.note && <p className="gc-entry-note">{entry.note}</p>}
              </div>
              <div className="gc-entry-actions">
                <button className="gc-entry-btn" onClick={() => openEdit(entry)}><Pencil size={12} /></button>
                <button className="gc-entry-btn gc-entry-btn--del" onClick={() => handleDelete(entry.id)}><Trash2 size={12} /></button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Add / Edit form ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="gc-form">
              <p className="gc-form-label">{editingId ? 'Modifier' : 'Nouvelle note'}</p>
              <input
                ref={titleRef}
                type="text"
                placeholder="Titre…"
                value={title}
                onChange={e => setTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') cancelForm() }}
                className="gc-input"
              />
              <textarea
                placeholder="Note (optionnel)…"
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={2}
                className="gc-input gc-textarea"
              />
              <div className="gc-colors">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`gc-color-swatch${color === c ? ' gc-color-swatch--active' : ''}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="gc-form-actions">
                <button className="gc-form-cancel" onClick={cancelForm}><X size={13} /> Annuler</button>
                <button className="gc-form-save" onClick={handleSave} disabled={!title.trim() || saving}>
                  <Check size={13} /> {saving ? 'En cours…' : (editingId ? 'Modifier' : 'Ajouter')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

GlassCalendar.displayName = 'GlassCalendar'
