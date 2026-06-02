import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useServices } from '@/features/invoice/hooks/useServices';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';

export default function CategoryBlock({ cat }: { cat: any }) {
  const { state, dispatch } = useInvoice();
  const { saveService, editService, deleteService } = useServices();
  const [dropOpen, setDropOpen] = useState(false);
  const [newSvcName, setNewSvcName] = useState('');
  const [editingName, setEditingName] = useState<{ name: string; value: string } | null>(null);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const newInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!dropOpen) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      const insideBtn = btnRef.current && btnRef.current.contains(target);
      const insideDrop = dropRef.current && dropRef.current.contains(target);
      if (!insideBtn && !insideDrop) setDropOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  function openDrop() {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
    setDropOpen((v) => !v);
  }

  const liveCat = state.cats.find((c: any) => c.id === cat.id) || cat;

  function updateSelected(newSelected: any[]) {
    dispatch({ type: 'UPDATE_CAT_SELECTED', catId: cat.id, selected: newSelected });
  }

  function updateServiceProp(idx: number, key: string, value: any) {
    const next = liveCat.selected.map((s: any, i: number) => i === idx ? { ...s, [key]: value } : s);
    updateSelected(next);
  }

  function removeService(idx: number) {
    updateSelected(liveCat.selected.filter((_: any, i: number) => i !== idx));
  }

  function addFromLibrary(name: string) {
    if (liveCat.selected.some((s: any) => s.name === name)) return;
    updateSelected([...liveCat.selected, { name, bold: false, fontSize: 15, price: '', showDot: true, colon: false }]);
  }

  async function doAdd() {
    const v = newSvcName.trim();
    if (!v) return;
    const alreadyInLib = liveCat.library.includes(v);
    if (!alreadyInLib) {
      await saveService(cat.id, v);
    }
    addFromLibrary(v);
    setNewSvcName('');
    if (newInputRef.current) newInputRef.current.focus();
  }

  async function doEdit(name: string, newName: string) {
    if (!newName || newName === name) { setEditingName(null); return; }
    const dbKey = `${cat.id}:${name}`;
    const uuid = state.savedServiceIds?.[dbKey];
    if (uuid) {
      await editService(uuid, cat.id, name, newName);
    }
    setEditingName(null);
  }

  async function doDelete(name: string) {
    if (!window.confirm(`Supprimer « ${name} » de la bibliothèque ?`)) return;
    const dbKey = `${cat.id}:${name}`;
    const uuid = state.savedServiceIds?.[dbKey];
    if (uuid) {
      await deleteService(uuid, cat.id, name);
    }
  }

  const isOpen = liveCat._open;

  const dropdown = dropOpen && dropPos ? createPortal(
    <AnimatePresence>
      <motion.div
        ref={dropRef}
        className="csel-dropdown"
        style={{
          position: 'absolute',
          zIndex: 9999,
          top: dropPos.top - 4,
          left: dropPos.left,
          width: dropPos.width,
          transform: 'translateY(-100%)',
        }}
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.18 }}
      >
        <div className="csel-list">
          {liveCat.library.map((name: string) => {
            const used = liveCat.selected.some((s: any) => s.name === name);
            const uuid = state.savedServiceIds?.[`${cat.id}:${name}`];
            return (
              <div
                key={name}
                className={`csel-option${used ? ' csel-option--active' : ''}`}
                style={{ opacity: used ? 0.45 : 1, pointerEvents: used ? 'none' : 'auto' }}
                onClick={() => { if (!used) { addFromLibrary(name); setDropOpen(false); } }}
              >
                {editingName?.name === name ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingName.value}
                    style={{ flex: 1, padding: '2px 6px', border: '1.5px solid var(--accent)', borderRadius: 8, fontFamily: 'inherit', fontSize: 13, outline: 'none', minWidth: 0, background: 'var(--surface)', color: 'var(--text)' }}
                    onChange={(e) => setEditingName({ name, value: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') doEdit(name, editingName.value.trim());
                      if (e.key === 'Escape') setEditingName(null);
                    }}
                    onBlur={() => doEdit(name, editingName.value.trim())}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span style={{ flex: 1 }}>{name}</span>
                )}

                {used && !editingName && <span className="csel-dot" />}

                {uuid && !editingName && (
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Modifier"
                      style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--muted)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); setEditingName({ name, value: name }); }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      title="Supprimer"
                      style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--red)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); doDelete(name); }}
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6"/><path d="M14 11v6"/>
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="drop-footer">
          <input
            ref={newInputRef}
            type="text"
            placeholder="Nouveau service..."
            value={newSvcName}
            onChange={(e) => setNewSvcName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doAdd(); }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="btn-confirm"
            style={{ background: cat.color }}
            onClick={(e) => { e.stopPropagation(); doAdd(); }}
          >
            Ajouter
          </button>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  ) : null;

  return (
    <div className="svc-cat-block" style={{ '--cat-color': cat.color, '--cat-bg': cat.bg, '--cat-border': cat.border } as React.CSSProperties}>
      <motion.div
        className="svc-cat-hdr"
        onClick={() => dispatch({ type: 'TOGGLE_CAT_OPEN', catId: cat.id })}
        style={{ borderColor: cat.border, background: cat.bg, cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="svc-cat-left">
          <span className="svc-cat-icon" style={{ color: cat.color }} dangerouslySetInnerHTML={{ __html: cat.iconHTML }} />
          <span className="svc-cat-name" style={{ color: cat.color }}>{cat.name}</span>
          {liveCat.selected.length > 0 && (
            <motion.span
              key={liveCat.selected.length}
              className="svc-cat-badge"
              style={{ background: cat.color }}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 400 }}
            >{liveCat.selected.length}</motion.span>
          )}
        </div>
        <motion.div
          className="svc-cat-chev"
          style={{ color: cat.color }}
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </motion.div>
      </motion.div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="svc-cat-body"
            style={{ borderColor: cat.border, overflow: 'hidden' }}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_ALT }}
          >
          {liveCat.selected.map((svc: any, idx: number) => (
            <div key={idx} className="svc-row">
              <span className="svc-row-dot" style={{ background: cat.color }} />
              <span className="svc-row-label" style={{ color: cat.color }}>{svc.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                <button
                  title={svc.showDot ? 'Masquer le point' : 'Afficher le point'}
                  style={{ width: 24, height: 24, border: `1.5px solid ${cat.border}`, borderRadius: 5, cursor: 'pointer', background: svc.showDot ? cat.color : 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
                  onClick={() => updateServiceProp(idx, 'showDot', !svc.showDot)}
                >
                  <svg width="7" height="7" viewBox="0 0 8 8">
                    <circle cx="4" cy="4" r="4" fill={svc.showDot ? 'white' : cat.color}/>
                  </svg>
                </button>
                <button
                  title='Ajouter/supprimer le ":"'
                  style={{ width: 24, height: 24, border: `1.5px solid ${cat.border}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', background: svc.colon ? cat.color : 'var(--white)', color: svc.colon ? 'white' : cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0, lineHeight: 1 }}
                  onClick={() => updateServiceProp(idx, 'colon', !svc.colon)}
                >:</button>
                <input
                  type="text"
                  value={svc.price || ''}
                  placeholder="Prix..."
                  style={{ width: 80, padding: '3px 6px', border: `1.5px solid ${cat.border}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 11, color: 'var(--text)', background: 'var(--white)', outline: 'none', textAlign: 'right' }}
                  onChange={(e) => updateServiceProp(idx, 'price', e.target.value)}
                />
                <button
                  title="Gras"
                  style={{ width: 24, height: 24, border: `1.5px solid ${cat.border}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: svc.bold ? cat.color : 'white', color: svc.bold ? 'white' : cat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0 }}
                  onClick={() => updateServiceProp(idx, 'bold', !svc.bold)}
                >B</button>
                <input
                  type="number"
                  min="8" max="30"
                  value={svc.fontSize || 15}
                  title="Taille"
                  style={{ width: 38, padding: '3px 4px', border: `1.5px solid ${cat.border}`, borderRadius: 5, fontFamily: 'inherit', fontSize: 11, color: 'var(--text)', background: 'var(--white)', outline: 'none', textAlign: 'center' }}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 8 && val <= 30) updateServiceProp(idx, 'fontSize', val);
                  }}
                />
              </div>
              <button
                className="svc-row-rm"
                style={{ color: cat.color }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = cat.border)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                onClick={() => removeService(idx)}
              >&times;</button>
            </div>
          ))}

          <div style={{ position: 'relative' }}>
            <button ref={btnRef} className="btn-add" onClick={openDrop}>
              <div className="btn-add-left">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Ajouter un service
              </div>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
            {dropdown}
          </div>
        </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
