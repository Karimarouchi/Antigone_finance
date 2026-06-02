import { useState } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import GlowCard from '@/components/GlowCard';

export default function EmetteurCard() {
  const { state, dispatch } = useInvoice();
  const [open, setOpen] = useState(false);

  return (
    <GlowCard><div className="card">
      <motion.div
        className="card-head"
        onClick={() => setOpen((o) => !o)}
        style={{ cursor: 'pointer' }}
        whileTap={{ scale: 0.98 }}
      >
        <span>Emetteur</span>
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
              <label>Email</label>
              <input
                type="email"
                value={state.email}
                onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'email', value: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Adresse</label>
              <input
                type="text"
                value={state.address}
                onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'address', value: e.target.value })}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div></GlowCard>
  );
}
