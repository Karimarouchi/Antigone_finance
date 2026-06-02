import { useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: 'default' | 'sm';
  disabled?: boolean;
}

export function CustomSelect({ value, onChange, options, placeholder = '— Sélectionner —', className = '', size = 'default', disabled = false }: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });

  const selected = options.find((o) => o.value === value);

  const close = useCallback(() => setOpen(false), []);

  /* Position the portal dropdown under the trigger */
  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPos({ top: rect.bottom + 6, left: rect.left, width: rect.width });
  }, []);

  useLayoutEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  useEffect(() => {
    if (!open) return;

    function handleClick(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      close();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    function handleScroll() { updatePos(); }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [open, close, updatePos]);

  return (
    <div className={`csel ${size === 'sm' ? 'csel--sm' : ''} ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={`csel-trigger ${open ? 'csel-trigger--open' : ''} ${!selected ? 'csel-trigger--placeholder' : ''}${disabled ? ' csel-trigger--disabled' : ''}`}
        onClick={() => { if (!disabled) setOpen((o) => !o); }}
        style={disabled ? { pointerEvents: 'none', opacity: 0.4, cursor: 'not-allowed' } : undefined}
      >
        <span className="csel-trigger-label">{selected ? selected.label : placeholder}</span>
        <svg className={`csel-chevron ${open ? 'csel-chevron--open' : ''}`} viewBox="0 0 24 24">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={dropdownRef}
              className="csel-dropdown"
              style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18, ease: EASE_OUT_ALT }}
            >
              <div className="csel-list">
                <button
                  type="button"
                  className={`csel-option ${!value ? 'csel-option--active' : ''}`}
                  onClick={() => { onChange(''); close(); }}
                >
                  <span>{placeholder}</span>
                  {!value && <span className="csel-dot" />}
                </button>
                {options.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    className={`csel-option ${value === opt.value ? 'csel-option--active' : ''}`}
                    onClick={() => { onChange(opt.value); close(); }}
                  >
                    <span>{opt.label}</span>
                    {value === opt.value && <span className="csel-dot" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
