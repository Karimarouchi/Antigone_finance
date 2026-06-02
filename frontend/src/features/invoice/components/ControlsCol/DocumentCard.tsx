import { useState, useEffect } from 'react';
import { DatePicker } from '@/components/ui/date-picker';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import { CustomSelect } from '@/components/ui/custom-select';
import GlowCard from '@/components/GlowCard';
import { LockConfirmDialog } from '@/features/invoice/components/LockConfirmDialog';
import { api } from '@/lib/api';

export default function DocumentCard() {
  const { state, dispatch } = useInvoice();
  const [open, setOpen] = useState(true);
  const [showLockDlg, setShowLockDlg] = useState(false);
  const [numExists, setNumExists] = useState(false);
  const [checkingNum, setCheckingNum] = useState(false);
  const isDevis = state.docType === 'Devis';

  // Debounced uniqueness check (only when unlocked)
  useEffect(() => {
    if (state.isLocked || !state.docNum) {
      setNumExists(false);
      return;
    }
    setCheckingNum(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.get('/api/payments/exists', { params: { num: state.docNum } });
        setNumExists(res.data.exists === true);
      } catch {
        setNumExists(false);
      } finally {
        setCheckingNum(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state.docNum, state.isLocked]);

  return (
    <>
    <GlowCard><div className="card">
      <motion.div
        className="card-head"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Détails du Document</span>
        <motion.div
          className="card-chev"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
        </motion.div>
      </motion.div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="card-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_ALT }}
            style={{ overflow: 'hidden' }}
          >
            <div className="field">
              <label>Type</label>
              <CustomSelect
                value={state.docType}
                onChange={(v) => dispatch({ type: 'SET_DOC_TYPE', value: v })}
                options={[
                  { value: 'FACTURE', label: 'FACTURE' },
                  { value: 'Devis', label: 'DEVIS' },
                ]}
                placeholder="Sélectionner un type"
              />
            </div>
            <div className="row2">
              <div className="field">
                <label>{isDevis ? 'N° Devis' : 'N° Facture'}</label>
                {state.isLocked ? (
                  <div
                    className="field-locked-num"
                    title="N° verrouillé — cliquez pour modifier"
                    onClick={() => setShowLockDlg(true)}
                  >
                    <span>{state.docNum}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, opacity: 0.5 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={state.docNum}
                      onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'docNum', value: e.target.value })}
                      style={numExists ? { borderColor: 'var(--red-600)' } : undefined}
                    />
                    {checkingNum && (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4, paddingLeft: 12 }}>Vérification…</div>
                    )}
                    {numExists && !checkingNum && (
                      <div style={{ fontSize: 11, color: 'var(--red-600)', fontWeight: 600, marginTop: 4, paddingLeft: 12 }}>
                        ⚠ Ce numéro existe déjà dans la base de données
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="field">
                <label>Date</label>
                <DatePicker value={state.docDate} onChange={(v) => dispatch({ type: 'SET_FIELD', key: 'docDate', value: v })} />
              </div>
            </div>
            <div className="fix-doc-row">
              <input
                type="checkbox"
                id="iFixDocument"
                className="custom-checkbox"
                checked={state.fixDocument}
                onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'fixDocument', value: e.target.checked })}
              />
              <div>
                <div className="fix-doc-title">Facture fixing / Autre copie…</div>
                <div className="fix-doc-desc">Réactiver Télécharger PDF &amp; Sauvegarder Drive pour un N° déjà utilisé</div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div></GlowCard>

    {showLockDlg && (
      <LockConfirmDialog
        docNum={state.docNum}
        onConfirm={() => {
          dispatch({ type: 'UNLOCK_NUM' });
          setShowLockDlg(false);
        }}
        onCancel={() => setShowLockDlg(false)}
      />
    )}
    </>
  );
}
