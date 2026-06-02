import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DatePicker } from '@/components/ui/date-picker';
import { motion } from 'framer-motion';
import { useMoisEnc } from './EncaissementsLayout';
import { api } from '@/lib/api';
import './payments.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentStatus = 'generated' | 'pending' | 'paid' | 'partial' | 'cancelled';

interface PaymentPartial {
  id: string;
  payment_id: string;
  montant: number;
  date: string;
  note: string;
  created_at: string;
}

interface Payment {
  id: string;
  invoice_number: string;
  client_id: string | null;
  client_name: string;
  total_ttc: number;
  amount_paid: number;
  status: PaymentStatus;
  date_issued: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  partials: PaymentPartial[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  const v = Number(n);
  if (!isFinite(v)) return '0,000';
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function delayDays(from: string, to: string) {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000));
}

function parseInvNum(s: string): number {
  const p = String(s || '').split('-');
  if (p.length === 2) {
    const y = parseInt(p[0], 10);
    const n = parseInt(p[1], 10);
    if (!isNaN(y) && !isNaN(n)) return y * 100000 + n;
  }
  return 0;
}

function monthKey(iso: string | null) {
  return iso ? iso.slice(0, 7) : '0000-00';
}

function fmtMonthLabel(key: string) {
  if (key === '0000-00') return 'Sans date';
  const [y, m] = key.split('-');
  const label = new Date(+y, +m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const STATUS_CFG: Record<PaymentStatus, { label: string; cls: string }> = {
  generated: { label: 'Générée',    cls: 'gray'  },
  pending:   { label: 'En attente', cls: 'blue'  },
  paid:      { label: 'Payée',      cls: 'green' },
  partial:   { label: 'Partiel',    cls: 'amber' },
  cancelled: { label: 'Annulée',    cls: 'red'   },
};

// ── Payment Card ──────────────────────────────────────────────────────────────

function PaymentCard({
  payment,
  priorVersions = [],
  onUpdate,
  onPartialAdded,
  onDelete,
}: {
  payment: Payment;
  priorVersions?: { version: number; total_ttc: number }[];
  onUpdate: (id: string, updates: Partial<Payment>) => void;
  onPartialAdded: (paymentId: string, partial: PaymentPartial) => void;
  onDelete: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const navigate = useNavigate();

  const [partialInput,   setPartialInput]   = useState('');
  const [editingPartial, setEditingPartial] = useState(false);
  const [partialDate,    setPartialDate]    = useState(today);
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [paidDate,       setPaidDate]       = useState(today);

  const cfg        = STATUS_CFG[payment.status];
  const parsedPaid = parseFloat(partialInput) || 0;
  const alreadyPaid = payment.amount_paid || 0;
  const remaining   = Math.max(0, payment.total_ttc - parsedPaid);

  async function updateStatus(status: PaymentStatus, extra: Partial<Payment> = {}) {
    const now = new Date().toISOString();
    const timestamps: Partial<Payment> = {};
    if (status === 'pending' && !payment.sent_at) timestamps.sent_at = now;
    if (status === 'pending' && payment.status === 'cancelled') timestamps.paid_at = null;
    const updates = { status, updated_at: now, ...timestamps, ...extra };
    try {
      await api.put(`/api/payments/${payment.id}`, updates);
      onUpdate(payment.id, updates);
    } catch { /* ignore */ }
  }

  async function insertPartialRecord(montant: number, date: string): Promise<PaymentPartial | null> {
    try {
      const { data } = await api.post<PaymentPartial>('/api/payment-partials', {
        payment_id: payment.id, montant, date,
      });
      return data ?? null;
    } catch { return null; }
  }

  async function switchToPartial() {
    const timestamps: Partial<Payment> = {};
    if (!payment.sent_at) timestamps.sent_at = new Date().toISOString();
    await updateStatus('partial', { amount_paid: 0, ...timestamps });
    setPartialInput('');
    setPartialDate(today);
    setEditingPartial(true);
  }

  async function confirmPartial() {
    const amount   = Math.min(parsedPaid, payment.total_ttc - alreadyPaid);
    const newTotal = +(alreadyPaid + amount).toFixed(3);
    const isFull   = newTotal >= payment.total_ttc;

    const partial = await insertPartialRecord(amount, partialDate);

    if (isFull) {
      await updateStatus('paid', {
        amount_paid: payment.total_ttc,
        paid_at: new Date(partialDate).toISOString(),
      });
    } else {
      await updateStatus('partial', { amount_paid: newTotal });
    }

    if (partial) onPartialAdded(payment.id, partial);
    setPartialInput('');
    setEditingPartial(false);
  }

  async function confirmPaid() {
    const remainingAmount = +(payment.total_ttc - alreadyPaid).toFixed(3);
    const partial = await insertPartialRecord(
      remainingAmount > 0 ? remainingAmount : payment.total_ttc,
      paidDate,
    );
    await updateStatus('paid', {
      amount_paid: payment.total_ttc,
      paid_at: new Date(paidDate).toISOString(),
    });
    if (partial) onPartialAdded(payment.id, partial);
    setConfirmingPaid(false);
  }

  return (
    <motion.div
      className={`payment-card payment-card--${payment.status}`}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="payment-card-main">
        {/* Invoice number + client */}
        <div className="payment-num-col">
          <div className="payment-num">{payment.invoice_number}</div>
          <div
            className="payment-client"
            style={payment.client_id ? { cursor: 'pointer', textDecorationLine: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '2px' } : undefined}
            onClick={() => payment.client_id && navigate(`/about/${payment.client_id}`)}
            title={payment.client_id ? 'Voir fiche client' : undefined}
          >
            {payment.client_name || '—'}
          </div>
        </div>

        {/* Dates + delay */}
        <div className="payment-date-col">
          <div className="payment-date">{fmtDate(payment.date_issued)}</div>
          {payment.paid_at && (
            <div className="payment-paid-on">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              {fmtDate(payment.paid_at)}
            </div>
          )}
          {payment.sent_at && payment.paid_at && (
            <div className="payment-delay">{delayDays(payment.sent_at, payment.paid_at)}j</div>
          )}
          {payment.sent_at && !payment.paid_at && payment.status !== 'cancelled' && (
            <div className="payment-delay payment-delay--pending">
              {delayDays(payment.sent_at, new Date().toISOString())}j en cours
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="payment-amount-col">
          {priorVersions.map((v) => (
            <div key={v.version} className="payment-prior-amount">
              <s>V{v.version} : {fmt(v.total_ttc)} DT</s>
            </div>
          ))}
          <div className="payment-amount">{fmt(payment.total_ttc)} DT</div>
          {payment.status === 'partial' && alreadyPaid > 0 && (
            <>
              <div className="payment-amount-sub">Payé: {fmt(alreadyPaid)} DT</div>
              <div className="payment-remaining">Reste: {fmt(payment.total_ttc - alreadyPaid)} DT</div>
            </>
          )}
        </div>

        {/* Status badge */}
        <div className="payment-status-col">
          <span className={`payment-badge payment-badge--${cfg.cls}`}>{cfg.label}</span>
        </div>

        {/* Actions */}
        <div className="payment-actions-col">
          {payment.status === 'generated' && (
            <>
              <button className="pay-action-btn pay-action-btn--blue" onClick={() => updateStatus('pending')}>
                Envoyée au client →
              </button>
              <button className="pay-action-btn pay-action-btn--red" onClick={() => updateStatus('cancelled')}>
                Annuler
              </button>
            </>
          )}
          {payment.status === 'pending' && !confirmingPaid && (
            <>
              <button className="pay-action-btn pay-action-btn--green" onClick={() => { setPaidDate(today); setConfirmingPaid(true); }}>
                Payée
              </button>
              <button className="pay-action-btn pay-action-btn--amber" onClick={switchToPartial}>
                Partiel
              </button>
              <button className="pay-action-btn pay-action-btn--red" onClick={() => updateStatus('cancelled')}>
                Annuler
              </button>
            </>
          )}
          {payment.status === 'partial' && !editingPartial && !confirmingPaid && (
            <>
              <button className="pay-action-btn pay-action-btn--amber" onClick={() => { setPartialInput(''); setPartialDate(today); setEditingPartial(true); }}>
                + Paiement
              </button>
              <button className="pay-action-btn pay-action-btn--green" onClick={() => { setPaidDate(today); setConfirmingPaid(true); }}>
                Soldée
              </button>
              <button className="pay-action-btn pay-action-btn--red" onClick={() => updateStatus('cancelled')}>
                Annuler
              </button>
            </>
          )}
          {payment.status === 'cancelled' && (
            <button className="pay-action-btn pay-action-btn--ghost" onClick={() => updateStatus('pending', { amount_paid: 0 })}>
              Réouvrir
            </button>
          )}
          <button
            className="pay-action-btn pay-action-btn--red"
            style={{ opacity: 0.65, marginTop: 2 }}
            onClick={async () => {
              if (!window.confirm(`Supprimer définitivement ${payment.invoice_number} ?`)) return;
              try {
                await api.delete(`/api/payments/${payment.id}`);
                onDelete(payment.id);
              } catch {
                alert('Erreur lors de la suppression.');
              }
            }}
          >
            Supprimer
          </button>
        </div>
      </div>

      {/* Payment history */}
      {payment.partials.length > 0 && (
        <div className="payment-history">
          {payment.partials.map((pp) => (
            <div key={pp.id} className="payment-history-entry">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ width: 10, height: 10, flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="phist-date">{fmtDate(pp.date)}</span>
              <span className="phist-dot">·</span>
              <span className="phist-amount">+{fmt(pp.montant)} DT</span>
            </div>
          ))}
        </div>
      )}

      {/* Full payment date confirmation */}
      {confirmingPaid && (
        <div className="payment-partial-row">
          <div className="partial-input-wrap">
            <label className="partial-label">Date de paiement</label>
            <DatePicker value={paidDate} onChange={setPaidDate} className="partial-input" />
          </div>
          <div className="partial-remaining">
            <span className="partial-remaining-label">Montant soldé</span>
            <span className="partial-remaining-value settled">{fmt(payment.total_ttc - alreadyPaid)} DT</span>
          </div>
          <div className="partial-actions">
            <button className="pay-action-btn pay-action-btn--green" onClick={confirmPaid}>Confirmer</button>
            <button className="pay-action-btn pay-action-btn--ghost" onClick={() => setConfirmingPaid(false)}>Annuler</button>
          </div>
        </div>
      )}

      {/* Partial payment editor */}
      {editingPartial && (
        <div className="payment-partial-row">
          <div className="partial-input-wrap">
            <label className="partial-label">Montant (DT)</label>
            <input
              type="number"
              className="partial-input"
              value={partialInput}
              onChange={(e) => setPartialInput(e.target.value)}
              placeholder="0.000"
              min="0"
              max={payment.total_ttc - alreadyPaid}
              step="0.001"
              autoFocus
            />
          </div>
          <div className="partial-input-wrap">
            <label className="partial-label">Date de paiement</label>
            <DatePicker value={partialDate} onChange={setPartialDate} className="partial-input" />
          </div>
          <div className="partial-remaining">
            <span className="partial-remaining-label">Reste après</span>
            <span className={`partial-remaining-value${remaining === 0 ? ' settled' : ''}`}>
              {fmt(Math.max(0, payment.total_ttc - alreadyPaid - parsedPaid))} DT
            </span>
          </div>
          <div className="partial-actions">
            <button className="pay-action-btn pay-action-btn--green" onClick={confirmPartial}>Confirmer</button>
            <button className="pay-action-btn pay-action-btn--ghost" onClick={() => setEditingPartial(false)}>Annuler</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function FacturesPage() {
  const moisKey = useMoisEnc();

  const [payments,     setPayments]     = useState<Payment[]>([]);
  const [priorMap,     setPriorMap]     = useState<Record<string, { version: number; total_ttc: number }[]>>({});
  const [loading,      setLoading]      = useState(true);
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'all'>('all');
  const [search,       setSearch]       = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (moisKey) {
        const [y, m] = moisKey.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        params.from = `${moisKey}-01`;
        params.to   = `${moisKey}-${String(lastDay).padStart(2, '0')}`;
      }

      const [paymentsRes, partialsRes, historyRes] = await Promise.all([
        api.get<any[]>('/api/payments', { params }),
        api.get<any[]>('/api/payment-partials'),
        api.get<any[]>('/api/facture-history'),
      ]);

      const normPartial = (pp: any): PaymentPartial => ({
        id: pp.id,
        payment_id: pp.payment_id ?? pp.paymentId,
        montant: Number(pp.montant ?? pp.amount ?? 0),
        date: pp.date ?? pp.paidAt ?? pp.date_paid ?? '',
        note: pp.note ?? '',
        created_at: pp.created_at ?? pp.createdAt ?? '',
      });
      const rawPartials = (partialsRes.data ?? []).map(normPartial);

      const mapped: Payment[] = (paymentsRes.data ?? []).map((p: any) => ({
        id: p.id,
        invoice_number: p.invoice_number ?? p.invoiceNumber ?? '',
        client_id: p.client_id ?? p.clientId ?? null,
        client_name: p.client_name ?? p.clientName ?? '',
        total_ttc: Number(p.total_ttc ?? p.totalTtc ?? 0),
        amount_paid: Number(p.amount_paid ?? p.amountPaid ?? 0),
        status: (((p.status ?? 'generated') === 'draft' ? 'generated' : (p.status ?? 'generated'))) as PaymentStatus,
        date_issued: p.date_issued ?? (Array.isArray(p.dateIssued) ? `${p.dateIssued[0]}-${String(p.dateIssued[1]).padStart(2,'0')}-${String(p.dateIssued[2]).padStart(2,'0')}` : p.dateIssued) ?? null,
        sent_at: p.sent_at ?? p.sentAt ?? null,
        paid_at: p.paid_at ?? p.paidAt ?? null,
        created_at: p.created_at ?? p.createdAt ?? '',
        updated_at: p.updated_at ?? p.updatedAt ?? '',
        partials: rawPartials.filter((pp) => pp.payment_id === p.id),
      }));

      // Build prior-versions map
      const histRows = (historyRes.data ?? []).map((r: any) => ({
        invoice_number: r.invoice_number ?? r.invoiceNumber ?? '',
        version: Number(r.version ?? 1),
        total_ttc: Number(r.total_ttc ?? r.totalTtc ?? 0),
      }));
      const grouped: Record<string, { version: number; total_ttc: number }[]> = {};
      histRows.forEach((r) => {
        if (!grouped[r.invoice_number]) grouped[r.invoice_number] = [];
        grouped[r.invoice_number].push({ version: r.version, total_ttc: r.total_ttc });
      });
      const newPriorMap: Record<string, { version: number; total_ttc: number }[]> = {};
      mapped.forEach((p) => {
        const versions = grouped[p.invoice_number] ?? [];
        const maxVersion = versions.reduce((mx, v) => Math.max(mx, v.version), 1);
        const priors = versions
          .filter((v) => v.version < maxVersion && v.total_ttc !== p.total_ttc)
          .sort((a, b) => a.version - b.version);
        if (priors.length > 0) newPriorMap[p.invoice_number] = priors;
      });

      mapped.sort((a, b) => {
        const da = a.date_issued || '';
        const db = b.date_issued || '';
        if (da !== db) return da.localeCompare(db);
        return parseInvNum(a.invoice_number) - parseInvNum(b.invoice_number);
      });

      setPayments(mapped);
      setPriorMap(newPriorMap);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [moisKey]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(id: string, updates: Partial<Payment>) {
    setPayments((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }

  function handlePartialAdded(paymentId: string, partial: PaymentPartial) {
    setPayments((prev) =>
      prev.map((p) => p.id === paymentId ? { ...p, partials: [...p.partials, partial] } : p),
    );
  }

  function handleDelete(id: string) {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  }

  // ── Filter chain ────────────────────────────────────────────────────────────

  let filtered = payments;
  if (filterStatus !== 'all') filtered = filtered.filter((p) => p.status === filterStatus);
  if (search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(
      (p) => p.invoice_number.toLowerCase().includes(q) || p.client_name.toLowerCase().includes(q),
    );
  }

  // ── Stats ────────────────────────────────────────────────────────────────────

  const totalFactured = filtered.reduce((s, p) => s + p.total_ttc, 0);
  const totalEncaisse = filtered.filter((p) => p.status === 'paid').reduce((s, p) => s + p.total_ttc, 0)
    + filtered.filter((p) => p.status === 'partial').reduce((s, p) => s + (p.amount_paid || 0), 0);
  const totalPending = filtered.filter((p) => p.status === 'pending').reduce((s, p) => s + p.total_ttc, 0);

  // ── Group by month ───────────────────────────────────────────────────────────

  const monthMap = new Map<string, Payment[]>();
  filtered.forEach((p) => {
    const key = monthKey(p.date_issued);
    if (!monthMap.has(key)) monthMap.set(key, []);
    monthMap.get(key)!.push(p);
  });
  const months = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  const countOf = (s: PaymentStatus) => payments.filter((p) => p.status === s).length;

  return (
    <div className="payments-page">
      {/* Stats */}
      <div className="payments-stats">
        <div className="pay-stat">
          <div className="pay-stat-label">Total facturé</div>
          <div className="pay-stat-value">{fmt(totalFactured)} DT</div>
        </div>
        <div className="pay-stat pay-stat--green">
          <div className="pay-stat-label">Encaissé</div>
          <div className="pay-stat-value">{fmt(totalEncaisse)} DT</div>
        </div>
        <div className="pay-stat pay-stat--amber">
          <div className="pay-stat-label">En attente</div>
          <div className="pay-stat-value">{fmt(totalPending)} DT</div>
        </div>
        <div className="pay-stat">
          <div className="pay-stat-label">Factures</div>
          <div className="pay-stat-value">{filtered.length}</div>
        </div>
      </div>

      {/* Status filter tabs + search */}
      <div className="payments-filter-tabs">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
          {(['all', 'generated', 'pending', 'partial', 'paid', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              className={`pay-filter-tab${filterStatus === s ? ' active' : ''}`}
              onClick={() => setFilterStatus(s)}
            >
              {s === 'all' ? 'Tout' : STATUS_CFG[s].label}
              <span className="pay-filter-count">
                {s === 'all' ? payments.length : countOf(s)}
              </span>
            </button>
          ))}
        </div>

        <div className="pay-search-wrap" style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            className="pay-search-input"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="payments-loading">Chargement…</div>
      ) : months.length === 0 ? (
        <div className="payments-empty">
          <svg viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="13" x2="15" y2="13"/>
          </svg>
          <p>Aucune facture trouvée</p>
          <span>
            {search ? 'Essayez de modifier vos filtres.' : 'Les factures apparaîtront ici.'}
          </span>
        </div>
      ) : (
        <div className="payments-months">
          {months.map(([key, items]) => {
            const monthTotal = items.reduce((s, p) => s + p.total_ttc, 0);
            const monthPaid  = items.filter((p) => p.status === 'paid').reduce((s, p) => s + p.total_ttc, 0)
              + items.filter((p) => p.status === 'partial').reduce((s, p) => s + (p.amount_paid || 0), 0);

            return (
              <motion.div
                key={key}
                className="payments-month-group"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="payments-month-hdr">
                  <div className="payments-month-label">{fmtMonthLabel(key)}</div>
                  <div className="payments-month-meta">
                    <span>{items.length} facture{items.length > 1 ? 's' : ''}</span>
                    <span className="pmeta-dot">·</span>
                    <span>{fmt(monthTotal)} DT TTC</span>
                    {monthPaid > 0 && (
                      <>
                        <span className="pmeta-dot">·</span>
                        <span className="pmeta-paid">{fmt(monthPaid)} DT encaissés</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="payments-list">
                  {items.map((p) => (
                    <PaymentCard
                      key={p.id}
                      payment={p}
                      priorVersions={priorMap[p.invoice_number]}
                      onUpdate={handleUpdate}
                      onPartialAdded={handlePartialAdded}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
