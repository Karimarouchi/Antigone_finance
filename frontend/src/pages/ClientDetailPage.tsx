import { Fragment, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { EASE_OUT_ALT } from '@/lib/framer-motion-constants';
import { ROUTES } from '@/config/routes';
import { InvoiceStaticPreview } from '@/features/invoice/InvoiceStaticPreview';
import '@/pages/client-detail.css';

/* ── Types ── */

interface ClientProfile {
  id: string;
  name: string;
  commercialName: string | null;
  matriculeFiscale: string | null;
  rne: string | null;
  industry: string | null;
  country: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  emailReceiverName: string | null;
  emailReceiverGender: string | null;
  joiningDate: string | null;
  billingCycle: string | null;
  logoUrl: string | null;
}

interface Payment {
  id: string;
  invoiceNumber: string;
  dateIssued: string;
  sentAt: string | null;
  paidAt: string | null;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'cancelled';
  totalHt: number;
  totalTva: number;
  totalTtc: number;
  amountPaid: number;
  notes: string | null;
  pdfKey?: string | null;
}

/* ── Helpers ── */

const BILLING_LABELS: Record<string, string> = {
  monthly: 'Mensuel', quarterly: 'Trimestriel',
  'semi-annual': 'Semestriel', yearly: 'Annuel', one_shot: 'Unique',
};

const STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon', pending: 'En attente', partial: 'Partiel',
  paid: 'Payé', cancelled: 'Annulé',
};

const STATUS_CLASS: Record<string, string> = {
  draft: 'status-draft', pending: 'status-pending', partial: 'status-partial',
  paid: 'status-paid', cancelled: 'status-cancelled',
};

function fmt(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function money(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function dn(c: { commercialName?: string | null; name: string }) {
  return c.commercialName?.trim() || c.name;
}

const AVATAR_COLORS = ['#e8621a', '#2563eb', '#7c3aed', '#16a34a', '#d97706', '#dc2626', '#0891b2', '#be185d'];
function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

const stagger = (i: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay: i * 0.06, ease: EASE_OUT_ALT },
});

/* ── Page ── */

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient]   = useState<ClientProfile | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [viewingPayment, setViewingPayment] = useState<Payment | null>(null);
  const [invoicePayload, setInvoicePayload] = useState<Record<string, any> | null>(null);
  const [payloadLoading, setPayloadLoading] = useState(false);

  function loadPayments() {
    if (!id) return;
    api.get<Payment[]>(`/api/clients/${id}/payments`).then((r) => setPayments(r.data));
  }

  // Fetch payload whenever a payment is selected for viewing
  useEffect(() => {
    if (!viewingPayment) {
      setInvoicePayload(null);
      return;
    }
    setPayloadLoading(true);
    api.get(`/api/facture-history/by-num/${encodeURIComponent(viewingPayment.invoiceNumber)}`)
      .then((r) => setInvoicePayload(r.data?.payload ?? null))
      .catch(() => setInvoicePayload(null))
      .finally(() => setPayloadLoading(false));
  }, [viewingPayment]);

  async function handlePay(p: Payment) {
    const amount = parseFloat(payAmount);
    if (isNaN(amount) || amount < 0) return;
    const ttc = Number(p.totalTtc);
    const newStatus = amount >= ttc ? 'paid' : amount > 0 ? 'partial' : 'pending';
    try {
      await api.put(`/api/payments/${p.id}`, { amountPaid: amount, status: newStatus });
      loadPayments();
      setPayingId(null);
      setPayAmount('');
    } catch {
      alert('Erreur lors de la mise à jour du paiement.');
    }
  }

  async function handleCancelPayment(p: Payment) {
    if (!window.confirm(`Annuler la facture ${p.invoiceNumber} ?`)) return;
    try {
      await api.put(`/api/payments/${p.id}`, { status: 'cancelled' });
      setPayments((prev) => prev.map((x) => x.id === p.id ? { ...x, status: 'cancelled' } : x));
    } catch {
      alert("Erreur lors de l'annulation.");
    }
  }

  async function handleDeletePayment(p: Payment) {
    if (!window.confirm(`Supprimer définitivement la facture ${p.invoiceNumber} ?`)) return;
    try {
      await api.delete(`/api/payments/${p.id}`);
      setPayments((prev) => prev.filter((x) => x.id !== p.id));
    } catch {
      alert('Erreur lors de la suppression.');
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      api.get<ClientProfile>(`/api/clients/${id}`),
      api.get<Payment[]>(`/api/clients/${id}/payments`),
    ]).then(([cRes, pRes]) => {
      setClient(cRes.data);
      setPayments(pRes.data);
    }).catch(() => {
      setError('Impossible de charger les données du client.');
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ padding: '80px', opacity: 0.5, fontSize: 14 }}>Chargement…</div>
  );
  if (error || !client) return (
    <div style={{ padding: '80px', color: '#f87171', fontSize: 14 }}>{error ?? 'Client introuvable.'}</div>
  );

  /* ── Stats ── */
  const totalFacturé  = payments.reduce((s, p) => s + Number(p.totalTtc),    0);
  const totalPayé     = payments.reduce((s, p) => s + Number(p.amountPaid),   0);
  const totalRestant  = totalFacturé - totalPayé;
  const countPaid     = payments.filter((p) => p.status === 'paid').length;
  const countPartial  = payments.filter((p) => p.status === 'partial').length;
  const countPending  = payments.filter((p) => p.status === 'pending').length;

  const displayName = dn(client);

  return (
    <div className="client-detail-page">
      {/* Back */}
      <motion.button
        className="client-detail-back"
        onClick={() => navigate(ROUTES.app.clients)}
        whileTap={{ scale: 0.95 }}
        {...stagger(0)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Retour aux clients
      </motion.button>

      {/* Header */}
      <motion.div className="client-detail-header" {...stagger(1)}>
        <div className="client-detail-avatar" style={{ background: client.logoUrl ? 'transparent' : avatarColor(displayName) }}>
          {client.logoUrl ? <img src={client.logoUrl} alt={displayName} /> : initials(displayName)}
        </div>
        <div className="client-detail-identity">
          <h1 className="client-detail-name">{displayName}</h1>
          {client.name !== displayName && (
            <div className="client-detail-legal">{client.name}</div>
          )}
          <div className="client-detail-meta">
            {[client.industry, client.city, client.country].filter(Boolean).join(' · ')}
          </div>
        </div>
        <div className="client-detail-badges">
          {client.billingCycle && (
            <span className="cd-badge cd-badge--blue">{BILLING_LABELS[client.billingCycle] ?? client.billingCycle}</span>
          )}
          {client.matriculeFiscale && (
            <span className="cd-badge">{client.matriculeFiscale}</span>
          )}
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="client-detail-stats">
        {[
          { label: 'Total facturé',  value: `${money(totalFacturé)} TND`,  sub: `${payments.length} facture${payments.length !== 1 ? 's' : ''}` },
          { label: 'Total payé',     value: `${money(totalPayé)} TND`,     sub: `${countPaid} payée${countPaid !== 1 ? 's' : ''}` },
          { label: 'Solde restant',  value: `${money(totalRestant)} TND`,  sub: `${countPartial} partiel${countPartial !== 1 ? 's' : ''}, ${countPending} en attente` },
        ].map((s, i) => (
          <motion.div key={s.label} className="cd-stat-card" {...stagger(i + 2)}>
            <div className="cd-stat-label">{s.label}</div>
            <div className="cd-stat-value">{s.value}</div>
            <div className="cd-stat-sub">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      <div className="client-detail-body">
        {/* Client Info */}
        <motion.div className="cd-info-card" {...stagger(5)}>
          <div className="cd-section-title">Informations</div>
          <div className="cd-info-rows">
            {client.email && <InfoRow label="Email" value={client.email} />}
            {client.emailReceiverName && <InfoRow label="Destinataire" value={`${client.emailReceiverGender ?? ''} ${client.emailReceiverName}`.trim()} />}
            {client.joiningDate && <InfoRow label="Adhésion" value={fmt(client.joiningDate)} />}
            {client.address && <InfoRow label="Adresse" value={client.address} />}
            {client.rne && <InfoRow label="RNE" value={client.rne} />}
            {client.matriculeFiscale && <InfoRow label="Matricule Fiscale" value={client.matriculeFiscale} />}
            {client.industry && <InfoRow label="Secteur" value={client.industry} />}
            {!client.email && !client.joiningDate && !client.address && !client.rne && !client.matriculeFiscale && !client.industry && (
              <div style={{ opacity: 0.4, fontSize: 13 }}>Aucune information supplémentaire.</div>
            )}
          </div>
        </motion.div>

        {/* Invoices Table */}
        <motion.div className="cd-invoices-card" {...stagger(6)}>
          <div className="cd-section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>
              Factures &amp; Paiements
              <span className="cd-count-badge">{payments.length}</span>
            </span>
            <button
              type="button"
              onClick={() => navigate('/encaissements/factures')}
              style={{
                fontSize: 12, fontWeight: 500, padding: '3px 10px', borderRadius: 6,
                border: '1px solid var(--border, #e5e7eb)', background: 'transparent',
                cursor: 'pointer', color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
              Encaissements
            </button>
          </div>

          {payments.length === 0 ? (
            <div className="cd-empty">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p>Aucune facture pour ce client.</p>
            </div>
          ) : (
            <div className="cd-table-wrap">
              <table className="cd-table">
                <thead>
                  <tr>
                    <th>N° Facture</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th>Montant &amp; Paiement</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p, i) => {
                    const ttc     = Number(p.totalTtc);
                    // Normalize: status=paid always means fully paid regardless of amountPaid field
                    const paid    = p.status === 'paid' ? ttc : Number(p.amountPaid);
                    const restant = Math.max(0, ttc - paid);
                    const pct     = ttc > 0 ? Math.min(100, (paid / ttc) * 100) : 0;
                    const isPaying = payingId === p.id;
                    const settled  = p.status === 'paid' || p.status === 'cancelled';
                    return (
                      <Fragment key={p.id}>
                        <motion.tr
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: i * 0.035 }}
                        >
                          <td className="cd-invoice-num">{p.invoiceNumber}</td>
                          <td className="cd-date">{fmt(p.dateIssued)}</td>
                          <td>
                            <span className={`cd-status ${STATUS_CLASS[p.status] ?? ''}`}>
                              {STATUS_LABEL[p.status] ?? p.status}
                            </span>
                          </td>
                          <td>
                            <div className="cd-amount-main">{money(ttc)} TND</div>
                            <div className="cd-pay-row">
                              <span className="cd-paid-inline">Payé {money(paid)}</span>
                              {restant > 0 && <span className="cd-restant-inline">Reste {money(restant)}</span>}
                            </div>
                            <div className="cd-progress-row">
                              <div className="cd-progress">
                                <div className="cd-progress-fill" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="cd-pct">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                          <td>
                            <div className="cd-row-actions">
                              <button className="cd-voir-btn" onClick={() => setViewingPayment(p)}>
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                Voir
                              </button>
                              {!settled && (
                                <button
                                  className={`cd-payer-btn${isPaying ? ' cd-payer-btn--active' : ''}`}
                                  onClick={() => { setPayingId(isPaying ? null : p.id); setPayAmount(''); }}
                                >
                                  {isPaying ? 'Fermer' : 'Payer'}
                                </button>
                              )}
                              {p.status !== 'cancelled' && p.status !== 'paid' && (
                                <button
                                  className="cd-payer-btn"
                                  style={{ background: 'rgba(239,68,68,0.1)', color: '#dc2626' }}
                                  onClick={() => handleCancelPayment(p)}
                                >
                                  Annuler
                                </button>
                              )}
                              <button
                                className="cd-payer-btn"
                                style={{ background: 'rgba(239,68,68,0.18)', color: '#b91c1c' }}
                                onClick={() => handleDeletePayment(p)}
                              >
                                Supprimer
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                        {isPaying && (
                          <tr className="cd-pay-form-row">
                            <td colSpan={5}>
                              <div className="cd-pay-form">
                                <input
                                  type="number"
                                  className="cd-pay-input"
                                  placeholder={`Montant payé sur ${money(ttc)} TND`}
                                  value={payAmount}
                                  min={0}
                                  max={ttc}
                                  step={0.001}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  autoFocus
                                  onKeyDown={(e) => e.key === 'Enter' && handlePay(p)}
                                />
                                <button className="cd-pay-confirm" onClick={() => handlePay(p)}>
                                  Confirmer
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
      {/* Invoice Preview Modal */}
      {viewingPayment && (
        <div className="inv-preview-overlay" onClick={() => setViewingPayment(null)}>
          <div className="inv-preview-wrap" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="inv-preview-hdr">
              <div className="inv-preview-hdr-left">
                <span className="inv-preview-num">Facture {viewingPayment.invoiceNumber}</span>
                <span className="inv-preview-sub">
                  {fmt(viewingPayment.dateIssued)}
                  <span className={`cd-status ${STATUS_CLASS[viewingPayment.status] ?? ''}`}>
                    {STATUS_LABEL[viewingPayment.status] ?? viewingPayment.status}
                  </span>
                </span>
              </div>
              <button className="inv-preview-x" onClick={() => setViewingPayment(null)} aria-label="Fermer">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Body — A4 preview or loading/no-data */}
            {payloadLoading ? (
              <div className="inv-preview-loading">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'email-spin 0.9s linear infinite' }}><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                Chargement de la facture…
              </div>
            ) : invoicePayload && Object.keys(invoicePayload).length > 0 ? (
              <InvoiceStaticPreview
                payload={invoicePayload}
                invoiceNumber={viewingPayment.invoiceNumber}
              />
            ) : (
              <div className="inv-preview-no-data">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></svg>
                <span>Aperçu non disponible pour cette facture</span>
                <span style={{ fontSize: 12, color: 'var(--faint)' }}>Les factures créées avant cette version n'ont pas d'aperçu enregistré</span>
              </div>
            )}

            {/* Footer */}
            <div className="inv-preview-footer">
              {viewingPayment.pdfKey && (
                <a
                  className="inv-preview-btn inv-preview-btn--dl"
                  href={`/api/storage/files/${viewingPayment.pdfKey}?download`}
                  target="_blank" rel="noreferrer"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Télécharger PDF
                </a>
              )}
              <button
                className="inv-preview-btn inv-preview-btn--edit"
                onClick={() => {
                  setViewingPayment(null);
                  navigate(ROUTES.app.invoice, {
                    state: {
                      editNum: viewingPayment.invoiceNumber,
                      invoicePayload: invoicePayload,
                    },
                  });
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Éditer la facture
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cd-info-row">
      <span className="cd-info-label">{label}</span>
      <span className="cd-info-value">{value}</span>
    </div>
  );
}
