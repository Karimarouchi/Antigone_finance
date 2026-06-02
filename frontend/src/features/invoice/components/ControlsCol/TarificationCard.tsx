import { useState } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { fmt, calcServiceSum } from '@/features/invoice/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import GlowCard from '@/components/GlowCard';

export default function TarificationCard() {
  const { state, dispatch } = useInvoice();
  const [open, setOpen] = useState(true);

  const isDevis = state.docType === 'Devis';
  const serviceSum = calcServiceSum(state.cats);
  const ht = Math.max(serviceSum, parseFloat(String(state.iHT)) || 0);
  const tvaAmt = isDevis ? 0 : ht * (parseFloat(String(state.iTVA)) || 0) / 100;
  const timbre = isDevis ? 0 : parseFloat(String(state.iTimbre)) || 0;
  const ttc = ht + tvaAmt + timbre;

  return (
    <GlowCard><div className="card">
      <motion.div
        className="card-head"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Tarification</span>
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
              <label>Total HT (DT)</label>
              <div className="dt-wrap">
                <input
                  type="number"
                  value={state.iHT}
                  step="100"
                  min="0"
                  onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'iHT', value: e.target.value })}
                />
                <em>DT</em>
              </div>
            </div>

            {!isDevis && (
              <div className="row2">
                <div className="field">
                  <label>TVA (%)</label>
                  <input
                    type="number"
                    value={state.iTVA}
                    step="0.5"
                    min="0"
                    onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'iTVA', value: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>Timbre Fiscal (DT)</label>
                  <input
                    type="number"
                    value={state.iTimbre}
                    step="0.001"
                    min="0"
                    onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'iTimbre', value: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div className="sep" />
            <div className="summary">
              <div className="sum-row">
                <span>{isDevis ? 'Montant HT' : 'Total HT'}</span>
                <span>{fmt(ht)}</span>
              </div>
              {!isDevis && (
                <>
                  <div className="sum-row">
                    <span>TVA</span>
                    <span>{fmt(tvaAmt)}</span>
                  </div>
                  <div className="sum-row">
                    <span>Timbre Fiscal</span>
                    <span>{fmt(timbre)}</span>
                  </div>
                  <div className="sum-row ttc">
                    <span>Total TTC</span>
                    <span>{fmt(ttc)}</span>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div></GlowCard>
  );
}
