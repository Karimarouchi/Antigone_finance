import { useState } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import CategoryBlock from './CategoryBlock';
import { motion, AnimatePresence } from 'framer-motion';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import GlowCard from '@/components/GlowCard';

const SM_BTNS = [
  { key: 'facebook', title: 'Facebook', svg: <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#1877f2" d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.791-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.268h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg> },
  { key: 'instagram', title: 'Instagram', svg: <svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" style={{stopColor:'#f09433'}}/><stop offset="25%" style={{stopColor:'#e6683c'}}/><stop offset="50%" style={{stopColor:'#dc2743'}}/><stop offset="75%" style={{stopColor:'#cc2366'}}/><stop offset="100%" style={{stopColor:'#bc1888'}}/></linearGradient></defs><path fill="url(#ig)" d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.975.975 1.246 2.242 1.308 3.608.058 1.265.07 1.645.07 4.851s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.975.975-2.242 1.246-3.608 1.308-1.265.058-1.645.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.975-.975-1.246-2.242-1.308-3.608C2.175 15.584 2.163 15.204 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.975-.975 2.242-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0-2.163C8.741 0 8.332.014 7.052.072 5.197.157 3.355.673 2.014 2.014.673 3.355.157 5.197.072 7.052.014 8.332 0 8.741 0 12c0 3.259.014 3.668.072 4.948.085 1.855.601 3.697 1.942 5.038 1.341 1.341 3.183 1.857 5.038 1.942C8.332 23.986 8.741 24 12 24s3.668-.014 4.948-.072c1.855-.085 3.697-.601 5.038-1.942 1.341-1.341 1.857-3.183 1.942-5.038.058-1.28.072-1.689.072-4.948s-.014-3.668-.072-4.948c-.085-1.855-.601-3.697-1.942-5.038C20.645.673 18.803.157 16.948.072 15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg> },
  { key: 'linkedin', title: 'LinkedIn', svg: <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#0a66c2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg> },
  { key: 'tiktok', title: 'TikTok', svg: <svg width="18" height="18" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z"/></svg> },
  { key: 'youtube', title: 'YouTube', svg: <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#ff0000" d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg> },
];

export default function ServicesCard() {
  const { state, dispatch } = useInvoice();
  const [masterOpen, setMasterOpen] = useState(true);

  const totalSelected = state.cats.reduce((s: number, c: any) => s + c.selected.length, 0);

  return (
    <GlowCard><div className="svc-card">
      <div className={`svc-master-hdr${masterOpen ? ' open' : ''}`} id="masterHdr">
        <div className="svc-master-left">
          <span className="svc-master-title">Services</span>
          <motion.span
            className="svc-total-badge"
            key={totalSelected}
            initial={{ scale: 1.4 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            {totalSelected}
          </motion.span>
        </div>
        <div className="svc-master-right">
          <motion.button
            type="button"
            title="Effacer tous les services"
            className="btn-icon-sm"
            onClick={() => dispatch({ type: 'RESET_SERVICES' })}
            whileTap={{ scale: 0.85, rotate: -90 }}
            whileHover={{ scale: 1.1 }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
          </motion.button>
          <motion.div
            className="master-chev"
            style={{ cursor: 'pointer' }}
            onClick={() => setMasterOpen((v) => !v)}
            animate={{ rotate: masterOpen ? 180 : 0 }}
            transition={{ duration: 0.25 }}
          >
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
          </motion.div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {masterOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE_OUT_ALT }}
            style={{ overflow: 'hidden' }}
          >
            <div id="svcTitleBlock">
              <div>
                <label className="field-label">Titre</label>
                <input
                  type="text"
                  className="svc-input svc-input--mb"
                  placeholder="ex: Social Media Management"
                  value={state.svcTitle}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'svcTitle', value: e.target.value })}
                  aria-label="Service title"
                />
                <div className="sm-btns-wrap">
                  {SM_BTNS.map(({ key, title, svg }) => (
                    <motion.button
                      key={key}
                      className={`sm-btn${state.selectedSM[key] ? ' active' : ''}`}
                      title={title}
                      onClick={() => dispatch({ type: 'TOGGLE_SM', key })}
                      whileTap={{ scale: 0.85 }}
                      whileHover={{ scale: 1.1 }}
                    >
                      {svg}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">Sous-titre</label>
                <input
                  type="text"
                  className="svc-input"
                  placeholder="ex: Habillage des réseaux sociaux"
                  value={state.svcSubtitle}
                  onChange={(e) => dispatch({ type: 'SET_FIELD', key: 'svcSubtitle', value: e.target.value })}
                  aria-label="Service subtitle"
                />
              </div>
            </div>

            <div className="svc-master-body open" id="masterBody">
              {state.cats.map((cat: any) => (
                <CategoryBlock key={cat.id} cat={cat} />
              ))}
            </div>

            <div className="svc-empty-bars open">
              <span className="svc-empty-label">Lignes vides</span>
              <div className="svc-empty-controls">
                <motion.button
                  className="btn-icon-md"
                  onClick={() => dispatch({ type: 'SET_FIELD', key: 'emptyBarCount', value: Math.max(0, state.emptyBarCount - 1) })}
                  whileTap={{ scale: 0.85 }}
                >−</motion.button>
                <motion.span
                  className="svc-empty-count"
                  key={state.emptyBarCount}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  {state.emptyBarCount}
                </motion.span>
                <motion.button
                  className="btn-icon-md"
                  onClick={() => dispatch({ type: 'SET_FIELD', key: 'emptyBarCount', value: state.emptyBarCount + 1 })}
                  whileTap={{ scale: 0.85 }}
                >+</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div></GlowCard>
  );
}
