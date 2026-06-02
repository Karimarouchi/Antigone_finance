import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, useInView } from 'motion/react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

interface Note {
  id:        string
  title:     string
  content:   string
  updatedAt: string
}

const PALETTES = [
  { gradient: 'from-[#fff8f5] to-[#ffe8d8] dark:from-[#4a220c] dark:to-[#2e1508]', accent: '#e8621a' },
  { gradient: 'from-[#fdf5ff] to-[#edd5ff] dark:from-[#2e1a55] dark:to-[#1d1038]', accent: '#9333ea' },
  { gradient: 'from-[#f0f4ff] to-[#dde6ff] dark:from-[#0f2050] dark:to-[#091632]', accent: '#4f6ef7' },
]

// ── Note card ────────────────────────────────────────────────────────────────

function NoteCard({ note, index, onSave, onDelete }: {
  note: Note; index: number
  onSave:   (id: string, title: string, content: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const [title,   setTitle]   = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [saving,  setSaving]  = useState(false)
  const [dirty,   setDirty]   = useState(false)
  const { gradient, accent }  = PALETTES[index % PALETTES.length]

  async function handleSave() {
    setSaving(true)
    await onSave(note.id, title, content)
    setDirty(false)
    setSaving(false)
  }

  return (
    <motion.div
      className={cn(
        'relative flex h-[420px] w-full flex-col justify-between overflow-hidden',
        'rounded-3xl bg-gradient-to-br p-6',
        'border border-black/[0.06] dark:border-white/[0.15] shadow-sm',
        'transition-shadow duration-300 hover:shadow-xl',
        gradient,
      )}
      variants={{
        hidden:  { opacity: 0, y: 40 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <span className="font-mono text-xs tracking-widest" style={{ color: `${accent}99` }}>
          ( {String(index + 1).padStart(2, '0')} )
        </span>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-black/5 dark:bg-white/10 text-black/30 dark:text-white/30 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-500"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
          </svg>
        </button>
      </div>

      {/* Editable body */}
      <div className="flex flex-1 flex-col gap-2 py-2 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(128,128,128,0.2) transparent' }}>
        <input
          className="w-full border-none bg-transparent p-0 text-sm font-bold uppercase tracking-widest text-black/80 dark:text-white/95 outline-none placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-black/25 dark:placeholder:text-white/35 shrink-0"
          value={title}
          onChange={e => { setTitle(e.target.value); setDirty(true) }}
          placeholder="Titre de la note…"
          maxLength={60}
        />
        <textarea
          className="w-full resize-none border-none bg-transparent p-0 text-[13px] leading-relaxed text-black/60 dark:text-white/75 outline-none placeholder:text-black/25 dark:placeholder:text-white/35 focus:text-black/80 dark:focus:text-white/90"
          value={content}
          onChange={e => { setContent(e.target.value); setDirty(true) }}
          placeholder="Écrivez vos notes ici…"
          spellCheck={false}
          rows={1}
          style={{ minHeight: '100%', height: 'auto', overflow: 'visible' }}
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-black/[0.07] dark:border-white/[0.15] pt-3">
        {note.updatedAt && (title || content) ? (
          <span className="text-[11px] text-black/30 dark:text-white/50">
            {new Date(note.updatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        ) : <span />}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className={cn(
            'rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all disabled:cursor-default',
            dirty ? 'text-white' : 'bg-white/70 dark:bg-white/15 border border-black/10 dark:border-white/20 text-black/40 dark:text-white/55 opacity-40',
          )}
          style={dirty ? { background: accent, color: '#fff', border: `1.5px solid ${accent}` } : {}}
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/[0.03] to-transparent rounded-3xl" />
    </motion.div>
  )
}

// ── Add card ─────────────────────────────────────────────────────────────────

function AddNoteCard({ onAdd, adding }: { onAdd: () => void; adding: boolean }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={adding}
      className={cn(
        'group relative flex h-[420px] w-full flex-col items-center justify-center gap-4',
        'rounded-3xl border-2 border-dashed border-black/15 dark:border-white/15',
        'bg-white/40 dark:bg-white/5 backdrop-blur-sm',
        'transition-all duration-300 hover:border-[#e8621a]/50 hover:bg-orange-50/40 dark:hover:bg-orange-900/20',
        'disabled:cursor-not-allowed disabled:opacity-60',
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white dark:bg-white/10 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:shadow-md">
        {adding ? (
          <svg className="animate-spin" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8621a" strokeWidth="2" strokeLinecap="round">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e8621a" strokeWidth="2.2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        )}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-black/50 dark:text-white/50 transition-colors group-hover:text-[#e8621a]">Nouvelle note</p>
        <p className="mt-1 text-xs text-black/30 dark:text-white/30">Cliquez pour ajouter</p>
      </div>
    </button>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

export default function NotesSection() {
  const [notes,   setNotes]   = useState<Note[]>([])
  const [adding,  setAdding]  = useState(false)
  const [seeded,  setSeeded]  = useState(false)

  const noteNumbers  = useRef<Map<string, number>>(new Map())
  const nextNumber   = useRef(1)
  const sectionRef   = useRef<HTMLElement>(null)
  const scrollerRef  = useRef<HTMLDivElement>(null)
  const maskRef      = useRef<HTMLDivElement>(null)
  const isInView     = useInView(sectionRef, { once: true, amount: 0.1 })
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  const CARD_W  = 324
  const FADE_PX = 96

  const updateFades = useCallback(() => {
    const el   = scrollerRef.current
    const mask = maskRef.current
    if (!el || !mask) return
    const maxScroll = el.scrollWidth - el.clientWidth
    const leftPx  = Math.min(el.scrollLeft, FADE_PX)
    const rightPx = Math.min(maxScroll - el.scrollLeft, FADE_PX)
    const leftGrad  = leftPx  > 0 ? `linear-gradient(to right, transparent 0px, black ${leftPx}px)` : null
    const rightGrad = rightPx > 0 ? `linear-gradient(to left, transparent 0px, black ${rightPx}px)` : null
    const both = [leftGrad, rightGrad].filter(Boolean)
    const value = both.length ? both.join(', ') : 'none'
    mask.style.maskImage          = value
    mask.style.webkitMaskImage    = value
    mask.style.maskComposite      = both.length === 2 ? 'intersect' : 'add'
    mask.style.webkitMaskComposite = both.length === 2 ? 'destination-in' : 'source-over'
    setCanScrollPrev(el.scrollLeft > 4)
    setCanScrollNext(el.scrollLeft < maxScroll - 4)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    updateFades()
    el.addEventListener('scroll', updateFades, { passive: true })
    function onWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return
      let node = e.target as HTMLElement | null
      while (node && node !== el) {
        const style = window.getComputedStyle(node)
        const oy = style.overflowY
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return
        node = node.parentElement
      }
      e.preventDefault()
      scrollerRef.current?.scrollBy({ left: e.deltaY * 1.2, behavior: 'auto' })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const ro = new ResizeObserver(updateFades)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateFades)
      el.removeEventListener('wheel', onWheel)
      ro.disconnect()
    }
  }, [updateFades])

  useEffect(() => { setTimeout(updateFades, 80) }, [notes.length, updateFades])

  function scrollPrev() { scrollerRef.current?.scrollBy({ left: -CARD_W, behavior: 'smooth' }) }
  function scrollNext() { scrollerRef.current?.scrollBy({ left: CARD_W, behavior: 'smooth' }) }

  const assignNumbers = (rows: Note[]) => {
    rows.forEach(n => {
      if (!noteNumbers.current.has(n.id)) noteNumbers.current.set(n.id, nextNumber.current++)
    })
  }

  // Load or seed notes
  useEffect(() => {
    api.get<Note[]>('/api/notes').then(async ({ data }) => {
      if (data && data.length > 0) {
        assignNumbers(data)
        setNotes(data)
      } else if (!seeded) {
        setSeeded(true)
        const seeds = await Promise.all(
          Array.from({ length: 3 }, () =>
            api.post<Note>('/api/notes', { title: '', content: '' }).then(r => r.data)
          )
        )
        assignNumbers(seeds)
        setNotes(seeds)
      }
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAdd() {
    setAdding(true)
    try {
      const { data } = await api.post<Note>('/api/notes', { title: '', content: '' })
      noteNumbers.current.set(data.id, nextNumber.current++)
      setNotes(prev => [...prev, data])
      setTimeout(() => {
        const el = scrollerRef.current
        if (el) el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' })
      }, 80)
    } catch {}
    setAdding(false)
  }

  async function handleSave(id: string, title: string, content: string) {
    const updatedAt = new Date().toISOString()
    try {
      await api.put(`/api/notes/${id}`, { title, content })
      setNotes(prev => prev.map(n => n.id === id ? { ...n, title, content, updatedAt } : n))
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/notes/${id}`)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch {}
  }

  return (
    <section ref={sectionRef} className="notes-section w-full" style={{ maxWidth: 'none', margin: '2rem 0 0', padding: '0 0 3rem' }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Notes</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 text-black/50 dark:text-white/50 shadow-sm transition-all hover:border-[#e8621a]/40 hover:text-[#e8621a] disabled:opacity-30 disabled:cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canScrollNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/10 text-black/50 dark:text-white/50 shadow-sm transition-all hover:border-[#e8621a]/40 hover:text-[#e8621a] disabled:opacity-30 disabled:cursor-default"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div ref={maskRef} className="overflow-hidden">
        <div
          ref={scrollerRef}
          className="overflow-x-auto pb-3"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <motion.div
            className="flex gap-4"
            style={{ width: 'max-content' }}
            initial="hidden"
            animate={isInView ? 'visible' : 'hidden'}
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
          >
            {notes.map((note) => (
              <div key={note.id} style={{ width: '300px', flexShrink: 0 }}>
                <NoteCard
                  note={note}
                  index={(noteNumbers.current.get(note.id) ?? 1) - 1}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              </div>
            ))}
            <div style={{ width: '300px', flexShrink: 0 }}>
              <AddNoteCard onAdd={handleAdd} adding={adding} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
