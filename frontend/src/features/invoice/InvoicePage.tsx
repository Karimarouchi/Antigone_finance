import { useEffect, useRef } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { todayISO } from '@/features/invoice/utils/format';
import { useCounters } from '@/features/invoice/hooks/useCounters';
import { useServices } from '@/features/invoice/hooks/useServices';
import ReminderBanner from '@/features/invoice/components/ReminderBanner/ReminderBanner';
import EmetteurCard from '@/features/invoice/components/ControlsCol/EmetteurCard';
import DocumentCard from '@/features/invoice/components/ControlsCol/DocumentCard';
import ClientCard from '@/features/invoice/components/ControlsCol/ClientCard';
import ServicesCard from '@/features/invoice/components/ControlsCol/ServicesCard';
import TarificationCard from '@/features/invoice/components/ControlsCol/TarificationCard';
import PreviewHeader from '@/features/invoice/components/PreviewCol/PreviewHeader';
import A4Page from '@/features/invoice/components/PreviewCol/A4Page';
import SaveTemplateDialog from '@/features/invoice/components/Modals/SaveTemplateDialog';
import TemplatePickerModal from '@/features/invoice/components/Modals/TemplatePickerModal';
import Dashboard from '@/features/invoice/components/Dashboard/Dashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import './invoice.css';

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay: i * 0.07, ease: EASE_OUT_ALT },
});

export default function InvoicePage() {
  const { loadCounters } = useCounters();
  const { loadSavedServices } = useServices();
  const { state, dispatch } = useInvoice();

  const prevDashboard = useRef(state.showDashboard);

  useEffect(() => {
    dispatch({ type: 'SET_FIELD', key: 'docDate', value: todayISO() });
    loadCounters();
    loadSavedServices();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.showDashboard !== prevDashboard.current) {
      window.dispatchEvent(new Event(state.showDashboard ? 'navbar-hide' : 'navbar-show'));
      prevDashboard.current = state.showDashboard;
    }
  }, [state.showDashboard]);

  return (
    <>
      <ReminderBanner />

      <motion.div className="invoice-toolbar" {...stagger(0)}>
        <div className="banner-counter-pill">
          <span className="banner-counter-label">Facture</span>
          <span className="banner-counter-value">
            {state.lastNumbers.facture || '—'}
          </span>
        </div>
        <motion.button
          className="btn-pill"
          onClick={() => dispatch({ type: 'TOGGLE_DASHBOARD' })}
          whileTap={{ scale: 0.95 }}
          whileHover={{ scale: 1.03 }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
            <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
          </svg>
          Historique
        </motion.button>
      </motion.div>

      <AnimatePresence mode="wait">
        {state.showDashboard ? (
          <motion.div
            key="dashboard"
            className="dash-inline-wrap"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            <Dashboard />
          </motion.div>
        ) : (
          <motion.div
            key="invoice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="app" id="app">
              <motion.div className="header" {...stagger(1)}>
                <div className="header-actions">
                  <SaveTemplateDialog />
                  <TemplatePickerModal />
                </div>
              </motion.div>

              <div className="controls-col">
                <motion.div {...stagger(2)}><EmetteurCard /></motion.div>
                <motion.div {...stagger(3)}><DocumentCard /></motion.div>
                <motion.div {...stagger(4)}><ClientCard /></motion.div>
                <motion.div {...stagger(5)}><ServicesCard /></motion.div>
                <motion.div {...stagger(6)}><TarificationCard /></motion.div>
                <motion.div {...stagger(7)}>
                  <motion.button
                    type="button"
                    className={`btn-stamp-toggle${state.showStamp ? ' btn-stamp-toggle--active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_FIELD', key: 'showStamp', value: !state.showStamp })}
                    whileTap={{ scale: 0.97 }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16, flexShrink: 0 }}>
                      <path d="M5 22h14"/>
                      <path d="M19.27 13.73A2.5 2.5 0 0 0 17 13h-1v-2a4 4 0 1 0-8 0v2H7a2.5 2.5 0 0 0-2.5 2.5V17h15v-3.27z"/>
                    </svg>
                    {state.showStamp ? 'Retirer le tampon' : 'Apposer le tampon'}
                  </motion.button>
                </motion.div>
              </div>

              <motion.div className="preview-col" {...stagger(2)}>
                <PreviewHeader />
                <div className="a4-pages" id="a4Pages">
                  <A4Page />
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
