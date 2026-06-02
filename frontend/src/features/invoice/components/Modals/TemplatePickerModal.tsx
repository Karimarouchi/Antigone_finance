import { useState } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useTemplates } from '@/features/invoice/hooks/useTemplates';
import TemplatePreview from './TemplatePreview';
import { motion, AnimatePresence } from 'framer-motion';
import GlowCard from '@/components/GlowCard';

export default function TemplatePickerModal() {
  const { state, dispatch } = useInvoice();
  const { loadTemplates, applyState, renameTemplate, deleteTemplate } = useTemplates();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState('');

  async function open() {
    dispatch({ type: 'TOGGLE_TPL_MODAL' });
    setLoading(true);
    const data = await loadTemplates();
    setTemplates(data);
    setLoading(false);
  }

  async function handleApply(tpl: any) {
    applyState(tpl.data);
    dispatch({ type: 'TOGGLE_TPL_MODAL' });
  }

  async function handleRename(id: string) {
    if (!renameVal.trim()) { setRenamingId(null); return; }
    const ok = await renameTemplate(id, renameVal.trim());
    if (ok) {
      setTemplates((prev) => prev.map((t) => t.id === id ? { ...t, name: renameVal.trim() } : t));
    }
    setRenamingId(null);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Supprimer ce template ?')) return;
    const ok = await deleteTemplate(id);
    if (ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <>
      <motion.button
        className="btn-pill"
        onClick={open}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.03 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        Templates
      </motion.button>

      <AnimatePresence>
        {state.showTplModal && (
          <motion.div
            className="tpl-modal-overlay"
            onClick={() => dispatch({ type: 'TOGGLE_TPL_MODAL' })}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            >
              <GlowCard borderRadius={60}>
                <div className="tpl-modal-box">
                  <div className="tpl-modal-header">
                    <div className="tpl-modal-title">Choisir un template</div>
                    <motion.button
                      type="button"
                      className="btn-icon-md"
                      aria-label="Close template modal"
                      onClick={() => dispatch({ type: 'TOGGLE_TPL_MODAL' })}
                      whileTap={{ scale: 0.85 }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </motion.button>
                  </div>

                  <div className="tpl-grid">
                    {loading ? (
                      <div className="tpl-loading">Chargement...</div>
                    ) : templates.length === 0 ? (
                      <div className="tpl-loading">Aucun template sauvegardé.</div>
                    ) : templates.map((tpl, i) => (
                      <motion.div
                        key={tpl.id}
                        className="tpl-card"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.3 }}
                      >
                        <TemplatePreview data={tpl.data} />

                        <div className="tpl-card-meta">
                          {renamingId === tpl.id ? (
                            <input
                              autoFocus
                              type="text"
                              className="tpl-rename-input"
                              value={renameVal}
                              onChange={(e) => setRenameVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(tpl.id);
                                if (e.key === 'Escape') setRenamingId(null);
                              }}
                              onBlur={() => handleRename(tpl.id)}
                            />
                          ) : (
                            <div className="tpl-card-name">{tpl.name}</div>
                          )}
                          <div className="tpl-card-actions">
                            <motion.button
                              className="tpl-btn-edit"
                              title="Renommer"
                              onClick={() => { setRenamingId(tpl.id); setRenameVal(tpl.name); }}
                              whileTap={{ scale: 0.85 }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                            </motion.button>
                            <motion.button
                              className="tpl-btn-delete"
                              title="Supprimer"
                              onClick={() => handleDelete(tpl.id)}
                              whileTap={{ scale: 0.85 }}
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/>
                              </svg>
                            </motion.button>
                          </div>
                        </div>

                        <motion.button
                          className="tpl-card-load-btn"
                          onClick={() => handleApply(tpl)}
                          whileTap={{ scale: 0.95 }}
                          whileHover={{ scale: 1.03 }}
                        >
                          Charger
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </GlowCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
