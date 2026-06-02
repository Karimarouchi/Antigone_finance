import { useRef, useLayoutEffect, useState } from 'react';
import { INITIAL_CATS } from '@/features/invoice/constants/categories';
import { SM_ORDER, SM_SVG } from '@/features/invoice/constants/socialMedia';
import { fmt, parsePrice } from '@/features/invoice/utils/format';

const CAT_MAP = Object.fromEntries(INITIAL_CATS.map((c) => [c.id, c]));

const A4_W = 794;
const SHOW_H = 480;

export default function TemplatePreview({ data }: { data: any }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.38);

  useLayoutEffect(() => {
    if (wrapRef.current) {
      setScale(wrapRef.current.offsetWidth / A4_W);
    }
  }, []);

  const {
    docType = 'FACTURE',
    svcTitle = '',
    svcSubtitle = '',
    selectedSM = {},
    emptyBarCount = 0,
    iHT = 0, iTVA = 19, iTimbre = 1,
    catsSelected = [],
  } = data || {};

  const isDevis = docType === 'Devis';

  const cats = (catsSelected as any[])
    .map((cs: any) => ({ ...CAT_MAP[cs.id], selected: cs.selected || [] }))
    .filter((c: any) => c.id);

  const allSvc = cats.flatMap((c: any) => c.selected as any[]);
  const hasSM = SM_ORDER.some((k) => selectedSM[k]);

  const serviceSum = allSvc.reduce((s: number, svc: any) => {
    const v = parsePrice(svc.price);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const ht     = Math.max(serviceSum, parseFloat(String(iHT)) || 0);
  const tvaAmt = isDevis ? 0 : ht * (parseFloat(String(iTVA)) || 0) / 100;
  const timbre = isDevis ? 0 : parseFloat(String(iTimbre)) || 0;
  const ttc    = ht + tvaAmt + timbre;

  return (
    <div
      ref={wrapRef}
      style={{ width: '100%', height: Math.round(SHOW_H * scale), overflow: 'hidden', borderRadius: '12px 12px 0 0', background: 'white', flexShrink: 0 }}
    >
      <div style={{
        width: A4_W,
        transformOrigin: 'top left',
        transform: `scale(${scale})`,
        background: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
        fontSize: 14,
        color: '#1d1d1f',
        padding: '44px 56px 0 65px',
        position: 'relative',
      }}>
        {/* Left decorative bar */}
        <img src="/Bg_Bar.png" alt="" style={{ position: 'absolute', top: 0, left: 0, width: 52, height: SHOW_H, objectFit: 'cover' }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <img src="/logo.png" style={{ width: 100, height: 'auto', mixBlendMode: 'multiply', display: 'block', marginBottom: 4 }} alt="Antigone" />
              <div style={{ fontSize: 17, fontWeight: 700 }}>ANTIGONE CREATIVE AGENCY</div>
              <div style={{ fontSize: 13, color: '#6e6e73', lineHeight: 1.65 }}>
                antigoneconsulting.info@gmail.com<br />
                012, RUE HABIB THAMEUR, RADES 2040<br />
                MF: 1761176/Q/A/M/000
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <span style={{ fontSize: 45, fontWeight: 900, letterSpacing: '-0.02em', display: 'block' }}>{docType.toUpperCase()}</span>
            </div>
          </div>

          {/* Services bar */}
          <div style={{ background: '#2d2d2d', color: 'white', textAlign: 'center', fontSize: 16, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '11px 0', borderRadius: 8, marginBottom: 10 }}>
            SERVICES
          </div>

          {svcTitle && (
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1d1d1f', marginBottom: svcSubtitle ? 2 : 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>{svcTitle}{hasSM ? ' :' : ''}</span>
              {SM_ORDER.filter((k) => selectedSM[k]).map((k) => (
                <span key={k} style={{ display: 'inline-flex', alignItems: 'center' }} dangerouslySetInnerHTML={{ __html: SM_SVG[k] }} />
              ))}
            </div>
          )}

          {svcSubtitle && (
            <div style={{ fontSize: 13, fontWeight: 600, color: '#6e6e73', marginBottom: 6 }}>{svcSubtitle}</div>
          )}

          {(allSvc.length > 0 || emptyBarCount > 0) && (
            <div style={{ border: '1px solid #ebebef', borderRadius: 8, overflow: 'hidden' }}>
              {allSvc.map((svc: any, i: number) => {
                const priceVal = parsePrice(svc.price);
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', fontSize: 15, borderBottom: '1px solid #ebebef', height: 40, background: i % 2 === 1 ? '#f9f9fb' : 'white' }}>
                    {svc.showDot !== false && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#e8621a', flexShrink: 0 }} />}
                    <span style={{ flex: 1, fontSize: svc.fontSize ? `${svc.fontSize}px` : undefined, fontWeight: svc.bold ? 700 : undefined }}>
                      &nbsp;{svc.name}{svc.colon ? ' :' : ''}
                    </span>
                    {!isNaN(priceVal) && svc.price && (
                      <span style={{ minWidth: 100, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                        {fmt(priceVal)}
                      </span>
                    )}
                  </div>
                );
              })}
              {Array.from({ length: emptyBarCount }).map((_, i) => (
                <div key={`g-${i}`} style={{ height: 40, borderBottom: '1px solid #ebebef' }} />
              ))}
            </div>
          )}

          {/* Totals */}
          <div style={{ borderTop: '1.5px solid #e0e0e5', paddingTop: 8, marginTop: 16 }}>
            {isDevis ? (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, padding: '3px 0', fontSize: 16, fontWeight: 700 }}>
                <span style={{ color: '#6e6e73', minWidth: 100, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Montant HT</span>
                <span style={{ minWidth: 110, textAlign: 'right', color: '#e8621a' }}>{fmt(ht)}</span>
              </div>
            ) : (
              <>
                {[
                  { l: 'Total HT', v: fmt(ht) },
                  { l: `TVA (${parseFloat(String(iTVA)) || 0}%)`, v: fmt(tvaAmt) },
                  { l: 'Timbre Fiscal', v: fmt(timbre) },
                ].map(({ l, v }) => (
                  <div key={l} style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, padding: '3px 0', fontSize: 14 }}>
                    <span style={{ color: '#6e6e73', minWidth: 100, textAlign: 'right', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{l}</span>
                    <span style={{ minWidth: 110, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 40, marginTop: 4 }}>
                  <div style={{ display: 'flex', gap: 40, borderTop: '1px solid #ebebef', paddingTop: 5 }}>
                    <span style={{ color: '#1d1d1f', minWidth: 100, textAlign: 'right', fontWeight: 700, fontSize: 16, textTransform: 'uppercase' }}>Total TTC</span>
                    <span style={{ minWidth: 110, textAlign: 'right', fontWeight: 700, fontSize: 16, color: '#e8621a', fontVariantNumeric: 'tabular-nums' }}>{fmt(ttc)}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
