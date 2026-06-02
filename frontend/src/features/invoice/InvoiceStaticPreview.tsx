/**
 * InvoiceStaticPreview
 *
 * Renders the A4 invoice page with a given state object (no routing context needed).
 * Used in the "Voir Facture" modal on ClientDetailPage.
 */
import { useReducer, useRef, useEffect, useState } from 'react';
import { InvoiceContext, reducer, initialState } from '@/features/invoice/context/InvoiceContext';
import A4Page from '@/features/invoice/components/PreviewCol/A4Page';
import './invoice.css';

interface Props {
  /** Raw payload object from /api/facture-history/by-num/{num} */
  payload: Record<string, any>;
  /** Invoice number to show if payload.docNum is missing */
  invoiceNumber?: string;
}

/** Merge the stored payload with initialState defaults so A4Page always has all fields */
function buildState(payload: Record<string, any>, invoiceNumber?: string) {
  const base = {
    ...initialState,
    cats: initialState.cats.map((c: any) => ({ ...c, selected: [], _open: false })),
  };

  // Restore cats with _open forced to false
  const cats = Array.isArray(payload.cats)
    ? payload.cats.map((c: any) => ({ ...c, _open: false }))
    : base.cats;

  return {
    ...base,
    ...payload,
    cats,
    docNum: invoiceNumber ?? payload.docNum ?? base.docNum,
    // Never show stamp drag UI in preview
    showStamp: false,
    // Never show interactive dialogs
    showSaveDialog: false,
    showTplModal: false,
    showDashboard: false,
    isLocked: true,
  };
}

export function InvoiceStaticPreview({ payload, invoiceNumber }: Props) {
  const stateInit = buildState(payload, invoiceNumber);
  const [state, dispatch] = useReducer(reducer, stateInit);

  // Calculate display scale so the 794px A4 fits in the modal body
  const [scale, setScale] = useState(0.82);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function computeScale() {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      const ratio = Math.min(1, (w - 40) / 794);
      setScale(Math.max(0.4, ratio));
    }
    computeScale();
    const ro = new ResizeObserver(computeScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <InvoiceContext.Provider value={{ state, dispatch }}>
      <div ref={containerRef} className="inv-preview-body">
        <div
          className="inv-preview-scaler"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            width: 794,
            height: 1123,
            marginBottom: `${(1123 * scale) - 1123}px`,
          }}
        >
          <A4Page />
        </div>
      </div>
    </InvoiceContext.Provider>
  );
}
