import { useRef, useLayoutEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { fmt, fmtDate, calcServiceSum, parsePrice } from '@/features/invoice/utils/format';
import { SM_ORDER, SM_SVG } from '@/features/invoice/constants/socialMedia';

const NATURAL_H = 50;
const MIN_H     = 18;
const THRESHOLD = 1073;

function adjustRowHeights(pageEl: HTMLElement) {
  const rows = pageEl.querySelectorAll<HTMLElement>('.inv-svc-row');
  if (!rows.length) return;

  const totalsAnchor = pageEl.querySelector<HTMLElement>('.page-totals-anchor');

  rows.forEach((r) => { r.style.height = '0px'; });

  const pgTop     = pageEl.getBoundingClientRect().top;
  const rowsStart = rows[0].getBoundingClientRect().top - pgTop;
  const anchorH   = totalsAnchor ? totalsAnchor.offsetHeight : 0;

  const spaceForRows = THRESHOLD - rowsStart - anchorH;
  const n   = rows.length;
  const rowH = spaceForRows >= n * NATURAL_H
    ? NATURAL_H
    : Math.max(MIN_H, Math.floor(spaceForRows / n));

  rows.forEach((r) => { r.style.height = `${rowH}px`; });
}

const STAMP_BASE = 200;

export interface A4PageHandle {
  getElement: () => HTMLDivElement | null;
}

const A4Page = forwardRef<A4PageHandle>((_, ref) => {
  const { state, dispatch } = useInvoice();
  const pageRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getElement: () => pageRef.current,
  }));

  const {
    docType, docNum, docDate, email, address,
    currentClient, cats, svcTitle, svcSubtitle,
    selectedSM, emptyBarCount, iHT, iTVA, iTimbre,
    showStamp,
  } = state;

  const isDevis = docType === 'Devis';

  const serviceSum = calcServiceSum(cats);
  const ht         = Math.max(serviceSum, parseFloat(String(iHT)) || 0);
  const tvaAmt     = isDevis ? 0 : ht * (parseFloat(String(iTVA)) || 0) / 100;
  const timbre     = isDevis ? 0 : parseFloat(String(iTimbre)) || 0;
  const ttc        = ht + tvaAmt + timbre;

  const allSvc = cats.flatMap((c: any) => c.selected ?? []).filter(Boolean);

  useLayoutEffect(() => {
    if (pageRef.current) adjustRowHeights(pageRef.current);
  });

  const hasSM = SM_ORDER.some((k) => selectedSM[k]);
  const numLabel    = isDevis ? 'Devis n°' : 'Facture n°';
  const clientLabel = isDevis ? 'Devis a' : 'Facture a';

  const [stampPos,   setStampPos]   = useState({ x: 580, y: 920 });
  const [stampScale, setStampScale] = useState(1);
  const dragRef   = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });
  const resizeRef = useRef({ active: false, sx: 0, sy: 0, scale: 1 });

  function onDragDown(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    const d = dragRef.current;
    d.active = true; d.sx = e.clientX; d.sy = e.clientY;
    d.px = stampPos.x; d.py = stampPos.y;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current.active) return;
    const { sx, sy, px, py } = dragRef.current;
    setStampPos({ x: px + e.clientX - sx, y: py + e.clientY - sy });
  }
  function onDragUp() { dragRef.current.active = false; }

  function onResizeDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation(); e.preventDefault();
    const r = resizeRef.current;
    r.active = true; r.sx = e.clientX; r.sy = e.clientY; r.scale = stampScale;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onResizeMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!resizeRef.current.active) return;
    const delta = (e.clientX - resizeRef.current.sx + e.clientY - resizeRef.current.sy) / 200;
    setStampScale(Math.max(0.3, Math.min(4, resizeRef.current.scale + delta)));
  }
  function onResizeUp() { resizeRef.current.active = false; }

  return (
    <div className="a4-page-wrap">
      <div className="a4-page" ref={pageRef}>
        {/* Left decorative bar */}
        <div className="inv-left-bar">
          <img src="/Bg_Bar.png" className="inv-left-bar-img" alt="" />
        </div>

        {/* Header */}
        <div>
          <div className="inv-head">
            <div>
              <div className="inv-brand">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <img src="/logo.png" className="inv-logo" alt="Antigone" />
                  <span className="inv-name">ANTIGONE CREATIVE AGENCY</span>
                </div>
                <div className="inv-meta">
                  {email}<br />{address}<br />MF: 1761176/Q/A/M/000
                </div>
              </div>
            </div>
            <div className="inv-badge">
              <span className="inv-title">{docType.toUpperCase()}</span>
              <div className="inv-info">
                Date : {fmtDate(docDate)}<br />
                {numLabel}{docNum}
              </div>
            </div>
          </div>

          <div className="inv-client">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="inv-client-lbl">{clientLabel}</div>
                <div className="inv-client-name">{currentClient?.name || ''}</div>
                <div className="inv-client-mf">MF: {currentClient?.matricule_fiscale || ''}</div>
              </div>
              {currentClient?.logo_url && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <img
                    src={currentClient.logo_url}
                    style={{ maxHeight: 64, maxWidth: 100, width: 'auto', height: 'auto', objectFit: 'contain', display: 'block', marginRight: 20 }}
                    alt="Client logo"
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services */}
        <div className="page-content">
          <div style={{
            flexShrink: 0, background: '#2d2d2d', color: 'white', textAlign: 'center',
            fontSize: 16, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
            padding: '11px 0', borderRadius: 8, marginBottom: 10,
          }}>
            SERVICES
          </div>

          {svcTitle && (
            <div style={{
              flexShrink: 0, fontSize: 20, fontWeight: 700, color: 'var(--text)',
              marginBottom: svcSubtitle ? 2 : 6,
              display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
            }}>
              <span>{svcTitle}{hasSM ? ' :' : ''}</span>
              {SM_ORDER.filter((k) => selectedSM[k]).map((k) => (
                <span
                  key={k}
                  style={{ display: 'inline-flex', alignItems: 'center' }}
                  dangerouslySetInnerHTML={{ __html: SM_SVG[k] }}
                />
              ))}
            </div>
          )}

          {svcSubtitle && (
            <div style={{
              flexShrink: 0, fontSize: 13, fontWeight: 600, color: 'var(--muted)',
              marginBottom: 6, letterSpacing: '0.04em',
            }}>
              {svcSubtitle}
            </div>
          )}

          {(allSvc.length > 0 || emptyBarCount > 0) && (
            <div className="inv-svc-list">
              {allSvc.map((svc: any, i: number) => {
                const priceVal = parsePrice(svc.price);
                return (
                  <div key={i} className="inv-svc-row">
                    {svc.showDot !== false && <span className="inv-dot" />}
                    <span style={{
                      flex: 1,
                      fontSize: svc.fontSize ? `${svc.fontSize}px` : undefined,
                      fontWeight: svc.bold ? 700 : undefined,
                    }}>
                      &nbsp;{svc.name}{svc.colon ? ' :' : ''}
                    </span>
                    {!isNaN(priceVal) && svc.price && (
                      <span style={{
                        minWidth: 120, textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        whiteSpace: 'nowrap', fontSize: 14,
                      }}>
                        {fmt(priceVal)}
                      </span>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: emptyBarCount }).map((_, i) => (
                <div key={`ghost-${i}`} className="inv-svc-row inv-svc-row-ghost">&nbsp;</div>
              ))}
            </div>
          )}
        </div>

        {/* Totals */}
        <div className="page-totals-anchor">
          <div className="inv-totals">
            <div className="totals-content">
              {isDevis ? (
                <div className="inv-tot-row big">
                  <span className="l">Montant HT</span>
                  <span className="v">{fmt(ht)}</span>
                </div>
              ) : (
                <>
                  <div className="inv-tot-row">
                    <span className="l">Total HT</span>
                    <span className="v">{fmt(ht)}</span>
                  </div>
                  <div className="inv-tot-row">
                    <span className="l">TVA ({parseFloat(String(iTVA)) || 0}%)</span>
                    <span className="v">{fmt(tvaAmt)}</span>
                  </div>
                  <div className="inv-tot-row">
                    <span className="l">Timbre Fiscal</span>
                    <span className="v">{fmt(timbre)}</span>
                  </div>
                  <div className="inv-tot-row div-line big">
                    <div className="inv-tot-inner">
                      <span className="l">Total TTC</span>
                      <span className="v">{fmt(ttc)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="page-num" />

        {/* Stamp toggle button */}
        <button
          className="stamp-toggle-btn"
          data-html2canvas-ignore="true"
          title={showStamp ? 'Masquer le cachet' : 'Afficher le cachet'}
          onClick={() => dispatch({ type: 'SET_FIELD', key: 'showStamp', value: !showStamp })}
        >
          {showStamp ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          )}
          Cachet
        </button>

        {/* Stamp overlay */}
        {showStamp && (
          <div
            className="stamp-wrap"
            style={{
              position: 'absolute',
              left:   stampPos.x,
              top:    stampPos.y,
              width:  STAMP_BASE * stampScale,
              height: STAMP_BASE * stampScale,
            }}
            onPointerDown={onDragDown}
            onPointerMove={onDragMove}
            onPointerUp={onDragUp}
          >
            <img src="/stamp.png" className="stamp-img" alt="" draggable={false} />
            <div
              className="stamp-resize-handle"
              data-html2canvas-ignore="true"
              onPointerDown={onResizeDown}
              onPointerMove={onResizeMove}
              onPointerUp={onResizeUp}
            />
          </div>
        )}
      </div>
    </div>
  );
});

A4Page.displayName = 'A4Page';
export default A4Page;
