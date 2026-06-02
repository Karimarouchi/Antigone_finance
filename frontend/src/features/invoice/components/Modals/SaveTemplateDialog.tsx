import { useState } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useTemplates } from '@/features/invoice/hooks/useTemplates';
import { motion, AnimatePresence } from 'framer-motion';
import GlowCard from '@/components/GlowCard';

export default function SaveTemplateDialog() {
  const { state, dispatch } = useInvoice();
  const { saveTemplate } = useTemplates();
  const [name, setName] = useState('');
  const [status, setStatus] = useState('');

  async function handleSave() {
    if (!name.trim()) { setStatus('Veuillez entrer un nom.'); return; }
    setStatus('Enregistrement…');
    const result = await saveTemplate(name.trim());
    if (!result) {
      setStatus('Erreur — veuillez réessayer.');
    } else if (result.error === 'duplicate') {
      setStatus('Ce nom existe déjà.');
    } else {
      setStatus('');
      setName('');
      dispatch({ type: 'TOGGLE_SAVE_DIALOG' });
    }
  }

  return (
    <>
      <motion.button
        className="btn-pill btn-pill--green"
        onClick={() => { dispatch({ type: 'TOGGLE_SAVE_DIALOG' }); setStatus(''); setName(''); }}
        whileTap={{ scale: 0.95 }}
        whileHover={{ scale: 1.03 }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
          <polyline points="17 21 17 13 7 13 7 21"/>
          <polyline points="7 3 7 8 15 8"/>
        </svg>
        Sauvegarder
      </motion.button>

      <AnimatePresence>
        {state.showSaveDialog && (
          <motion.div
            className="modal-overlay"
            onClick={() => dispatch({ type: 'TOGGLE_SAVE_DIALOG' })}
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
                <div className="modal-box">
                  <div className="modal-title">Sauvegarder le template</div>
                  <input
                    type="text"
                    className="modal-input"
                    placeholder="Nom du template..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                    autoFocus
                  />
                  <div className="modal-btn-row">
                    <motion.button
                      type="button"
                      className="btn-modal-cancel"
                      onClick={() => dispatch({ type: 'TOGGLE_SAVE_DIALOG' })}
                      whileTap={{ scale: 0.95 }}
                    >
                      Annuler
                    </motion.button>
                    <motion.button
                      type="button"
                      className="btn-modal-confirm"
                      onClick={handleSave}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      Enregistrer
                    </motion.button>
                  </div>
                  <AnimatePresence>
                    {status && (
                      <motion.div
                        className="modal-status"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                      >
                        {status}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </GlowCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
