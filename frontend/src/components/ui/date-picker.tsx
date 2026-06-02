import * as React from 'react'
import { createPortal } from 'react-dom'
import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'
import { DayPicker } from 'react-day-picker'
import '@/components/ui/rdp-style.css'

interface DatePickerProps {
  value:        string | null | undefined
  onChange:     (value: string) => void
  placeholder?: string
  className?:   string
  disabled?:    boolean
  id?:          string
}

const POPOVER_W = 260
const POPOVER_H = 290
const GAP       = 4

type Pos = { top?: number; bottom?: number; left: number }

export function DatePicker({ value, onChange, placeholder = 'Sélectionner une date', className, disabled, id }: DatePickerProps) {
  const [open,     setOpen]     = React.useState(false)
  const [pos,      setPos]      = React.useState<Pos>({ top: 0, left: 0 })
  const inputRef   = React.useRef<HTMLInputElement>(null)
  const popoverRef = React.useRef<HTMLDivElement>(null)

  const selected = React.useMemo(() => {
    if (!value) return undefined
    const d = parseISO(value)
    return isValid(d) ? d : undefined
  }, [value])

  function computePos() {
    const r = inputRef.current?.getBoundingClientRect()
    if (!r) return
    const spaceBelow = window.innerHeight - r.bottom - GAP
    const left       = Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_W - 8))
    if (spaceBelow < POPOVER_H && r.top > POPOVER_H) {
      // anchor bottom of calendar to top of input
      setPos({ bottom: window.innerHeight - r.top + GAP, left })
    } else {
      // anchor top of calendar to bottom of input
      setPos({ top: r.bottom + GAP, left })
    }
  }

  function openPicker() {
    if (disabled) return
    computePos()
    setOpen(true)
  }

  function handleSelect(date: Date | undefined) {
    if (date) { onChange(format(date, 'yyyy-MM-dd')); setOpen(false) }
  }

  React.useEffect(() => {
    if (!open) return
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node
      if (inputRef.current?.contains(t) || popoverRef.current?.contains(t)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  React.useEffect(() => {
    if (!open) return
    window.addEventListener('scroll', computePos, true)
    window.addEventListener('resize', computePos)
    return () => {
      window.removeEventListener('scroll', computePos, true)
      window.removeEventListener('resize', computePos)
    }
  }, [open])

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        readOnly
        disabled={disabled}
        value={selected ? format(selected, 'dd/MM/yyyy') : ''}
        placeholder={placeholder}
        type="text"
        className={className}
        style={{ cursor: 'pointer' }}
        onClick={openPicker}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPicker() } }}
      />
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          className="dp-popover"
          style={{
            position:     'fixed',
            top:          pos.top,
            bottom:       pos.bottom,
            left:         pos.left,
            zIndex:       99999,
            background:   'var(--white, #ffffff)',
            border:       '1px solid var(--border, #e0e0e5)',
            borderRadius: '20px',
            boxShadow:    '0 12px 40px rgba(0,0,0,0.16)',
            padding:      '14px',
            width:        '260px',
          }}
        >
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            locale={fr}
            captionLayout="dropdown"
            defaultMonth={selected ?? new Date()}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(new Date().getFullYear() + 30, 11)}
            autoFocus
          />
        </div>,
        document.body
      )}
    </>
  )
}
