import { useState, useEffect } from 'react';
import { useMoisEnc } from './EncaissementsLayout';
import { ROUTES } from '@/config/routes';
import { api } from '@/lib/api';
import './vue-ensemble.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentStatus = 'generated' | 'pending' | 'paid' | 'partial' | 'cancelled';
type AutreRevenuCategorie = 'consulting' | 'vente' | 'subvention' | 'remboursement' | 'loyer' | 'autre';

interface Payment {
  id: string;
  invoice_number: string;
  client_name: string;
  total_ttc: number;
  amount_paid: number;
  status: PaymentStatus;
  date_issued: string | null;
  paid_at: string | null;
}

interface AutreRevenu {
  id: string;
  label: string;
  montant: number;
  tvaTaux: number;
  date: string;
  categorie: AutreRevenuCategorie;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

const STATUS_LABEL: Record<PaymentStatus, string> = {
  generated: 'Générée',
  pending:   'En attente',
  paid:      'Payée',
  partial:   'Partiel',
  cancelled: 'Annulée',
};

const STATUS_COLOR: Record<PaymentStatus, string> = {
  generated: '#aeaeb2',
  pending:   '#7dd3fc',
  paid:      '#86efac',
  partial:   '#fde047',
  cancelled: '#fca5a5',
};

const CAT_LABELS: Record<AutreRevenuCategorie, string> = {
  consulting:    'Consulting',
  vente:         'Vente',
  subvention:    'Subvention',
  remboursement: 'Remboursement',
  loyer:         'Loyer',
  autre:         'Autre',
};

const CAT_COLOR: Record<AutreRevenuCategorie, string> = {
  consulting:    '#7dd3fc',
  vente:         '#86efac',
  subvention:    '#fde047',
  remboursement: '#c084fc',
  loyer:         '#fb923c',
  autre:         '#aeaeb2',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function VueEnsemble() {
  const moisKey = useMoisEnc();

  const [payments,   setPayments]   = useState<Payment[]>([]);
  const [revenus,    setRevenus]    = useState<AutreRevenu[]>([]);
  const [loadingPay, setLoadingPay] = useState(true);
  const [loadingRev, setLoadingRev] = useState(true);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!moisKey) return;
    const [y, m] = moisKey.split('-').map(Number);
    const from = `${moisKey}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${moisKey}-${String(lastDay).padStart(2, '0')}`;

    setLoadingPay(true);
    api
      .get<Record<string, unknown>[]>('/api/payments', { params: { from, to } })
      .then(({ data }) => {
        const mapped: Payment[] = (data ?? []).map((p) => ({
          id:             String(p.id ?? ''),
          invoice_number: String(p.invoiceNumber ?? p.invoice_number ?? ''),
          client_name:    String(p.clientName ?? p.client_name ?? ''),
          total_ttc:      Number(p.totalTtc ?? p.total_ttc ?? 0),
          amount_paid:    Number(p.amountPaid ?? p.amount_paid ?? 0),
          status:         (p.status ?? 'generated') as PaymentStatus,
          date_issued:    (p.dateIssued ?? p.date_issued ?? null) as string | null,
          paid_at:        (p.paidAt ?? p.paid_at ?? null) as string | null,
        }));
        setPayments(mapped);
        setLoadingPay(false);
      })
      .catch(() => setLoadingPay(false));

    setLoadingRev(true);
    api
      .get<AutreRevenu[]>('/api/autres-revenus', { params: { from, to } })
      .then(({ data }) => { setRevenus(data ?? []); setLoadingRev(false); })
      .catch(() => setLoadingRev(false));
  }, [moisKey]);

  const loading = loadingPay || loadingRev;

  // ── Factures aggregations ──────────────────────────────────────────────────

  const totalFacture  = payments.reduce((s, p) => s + p.total_ttc, 0);
  const totalEncaisse = payments
    .filter((p) => p.status === 'paid')
    .reduce((s, p) => s + p.total_ttc, 0)
    + payments.filter((p) => p.status === 'partial')
      .reduce((s, p) => s + (p.amount_paid || 0), 0);
  const totalPending  = payments
    .filter((p) => p.status === 'pending')
    .reduce((s, p) => s + p.total_ttc, 0);
  const totalRemaining = totalFacture - totalEncaisse;

  const statusGroups = (['paid', 'partial', 'pending', 'generated', 'cancelled'] as PaymentStatus[])
    .map((st) => ({
      status: st,
      count:  payments.filter((p) => p.status === st).length,
      amount: payments.filter((p) => p.status === st).reduce((s, p) =>
        s + (st === 'partial' ? (p.amount_paid || 0) : p.total_ttc), 0),
    }))
    .filter((g) => g.count > 0);

  // ── Autres revenus aggregations ────────────────────────────────────────────

  const totalRevenusTTC = revenus.reduce((s, r) => s + r.montant, 0);
  const totalRevenusHT  = revenus.reduce((s, r) => {
    const taux = r.tvaTaux ?? 0;
    const ht   = taux > 0 ? r.montant / (1 + taux / 100) : r.montant;
    return s + ht;
  }, 0);
  const totalRevenusTVA = +(totalRevenusTTC - totalRevenusHT).toFixed(3);

  const catGroups = (Object.keys(CAT_LABELS) as AutreRevenuCategorie[])
    .map((cat) => ({
      cat,
      count:  revenus.filter((r) => r.categorie === cat).length,
      amount: revenus.filter((r) => r.categorie === cat).reduce((s, r) => s + r.montant, 0),
    }))
    .filter((g) => g.count > 0)
    .sort((a, b) => b.amount - a.amount);

  // ── Grand total ────────────────────────────────────────────────────────────

  const grandTotal    = totalEncaisse + totalRevenusTTC;
  const encaisseShare = grandTotal > 0 ? (totalEncaisse / grandTotal) * 100 : 0;
  const revenusShare  = grandTotal > 0 ? (totalRevenusTTC / grandTotal) * 100 : 0;

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ve-loading">
        <div className="ve-spinner" />
        <span>Chargement…</span>
      </div>
    );
  }

  return (
    <div className="ve-page">

      {/* ── KPI row ── */}
      <div className="ve-kpi-row">
        <div className="ve-kpi ve-kpi--accent">
          <div className="ve-kpi-label">Total encaissé</div>
          <div className="ve-kpi-value">{fmt(grandTotal)}</div>
          <div className="ve-kpi-sub">Factures + Autres revenus · TND</div>
        </div>
        <div className="ve-kpi">
          <div className="ve-kpi-label">Factures encaissées</div>
          <div className="ve-kpi-value">{fmt(totalEncaisse)}</div>
          <div className="ve-kpi-sub">
            {payments.filter((p) => p.status === 'paid' || p.status === 'partial').length} facture(s) · TND
          </div>
        </div>
        <div className="ve-kpi">
          <div className="ve-kpi-label">Autres revenus</div>
          <div className="ve-kpi-value">{fmt(totalRevenusTTC)}</div>
          <div className="ve-kpi-sub">{revenus.length} entrée(s) · TND TTC</div>
        </div>
        <div className="ve-kpi">
          <div className="ve-kpi-label">En attente</div>
          <div className="ve-kpi-value ve-kpi-value--muted">{fmt(totalPending)}</div>
          <div className="ve-kpi-sub">Factures non réglées · TND</div>
        </div>
      </div>

      {/* ── Source breakdown bar ── */}
      {grandTotal > 0 && (
        <div className="ve-card">
          <div className="ve-card-title">Répartition des encaissements</div>
          <div className="ve-source-bar">
            <div className="ve-source-bar-fill ve-source-bar-fill--factures" style={{ width: `${encaisseShare}%` }} />
            <div className="ve-source-bar-fill ve-source-bar-fill--revenus"  style={{ width: `${revenusShare}%` }} />
          </div>
          <div className="ve-source-legend">
            <div className="ve-source-legend-item">
              <span className="ve-source-dot ve-source-dot--factures" />
              <span>Factures</span>
              <strong>{fmt(totalEncaisse)} TND</strong>
              <span className="ve-source-pct">({encaisseShare.toFixed(0)}%)</span>
            </div>
            <div className="ve-source-legend-item">
              <span className="ve-source-dot ve-source-dot--revenus" />
              <span>Autres revenus</span>
              <strong>{fmt(totalRevenusTTC)} TND</strong>
              <span className="ve-source-pct">({revenusShare.toFixed(0)}%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Two-column section ── */}
      <div className="ve-two-col">

        {/* Factures */}
        <div className="ve-card">
          <div className="ve-card-header">
            <div className="ve-card-title">Factures</div>
            <a href={ROUTES.app.encaissements.factures} className="ve-card-link">Voir tout →</a>
          </div>

          <div className="ve-stat-row">
            <div className="ve-stat">
              <div className="ve-stat-label">Facturé</div>
              <div className="ve-stat-val">{fmt(totalFacture)} <span>TND</span></div>
            </div>
            <div className="ve-stat">
              <div className="ve-stat-label">Encaissé</div>
              <div className="ve-stat-val ve-stat-val--green">{fmt(totalEncaisse)} <span>TND</span></div>
            </div>
            <div className="ve-stat">
              <div className="ve-stat-label">Reste</div>
              <div className="ve-stat-val ve-stat-val--muted">{fmt(totalRemaining)} <span>TND</span></div>
            </div>
          </div>

          {totalFacture > 0 && (
            <div className="ve-progress-wrap">
              <div className="ve-progress-bar">
                <div
                  className="ve-progress-fill"
                  style={{ width: `${Math.min(100, (totalEncaisse / totalFacture) * 100)}%` }}
                />
              </div>
              <div className="ve-progress-label">
                {((totalEncaisse / totalFacture) * 100).toFixed(0)}% encaissé
              </div>
            </div>
          )}

          {statusGroups.length > 0 && (
            <div className="ve-breakdown">
              {statusGroups.map((g) => (
                <div key={g.status} className="ve-breakdown-row">
                  <span className="ve-breakdown-dot" style={{ background: STATUS_COLOR[g.status] }} />
                  <span className="ve-breakdown-label">{STATUS_LABEL[g.status]}</span>
                  <span className="ve-breakdown-count">{g.count}</span>
                  <span className="ve-breakdown-amount">{fmt(g.amount)} TND</span>
                </div>
              ))}
            </div>
          )}

          {payments.length === 0 && <div className="ve-empty">Aucune facture ce mois</div>}
        </div>

        {/* Autres revenus */}
        <div className="ve-card">
          <div className="ve-card-header">
            <div className="ve-card-title">Autres revenus</div>
            <a href={ROUTES.app.encaissements.autresRevenus} className="ve-card-link">Voir tout →</a>
          </div>

          <div className="ve-stat-row">
            <div className="ve-stat">
              <div className="ve-stat-label">Total TTC</div>
              <div className="ve-stat-val">{fmt(totalRevenusTTC)} <span>TND</span></div>
            </div>
            <div className="ve-stat">
              <div className="ve-stat-label">Total HT</div>
              <div className="ve-stat-val">{fmt(totalRevenusHT)} <span>TND</span></div>
            </div>
            <div className="ve-stat">
              <div className="ve-stat-label">TVA collectée</div>
              <div className="ve-stat-val ve-stat-val--purple">{fmt(totalRevenusTVA)} <span>TND</span></div>
            </div>
          </div>

          {catGroups.length > 0 && (
            <div className="ve-breakdown">
              {catGroups.map((g) => (
                <div key={g.cat} className="ve-breakdown-row">
                  <span className="ve-breakdown-dot" style={{ background: CAT_COLOR[g.cat] }} />
                  <span className="ve-breakdown-label">{CAT_LABELS[g.cat]}</span>
                  <span className="ve-breakdown-count">{g.count}</span>
                  <span className="ve-breakdown-amount">{fmt(g.amount)} TND</span>
                </div>
              ))}
            </div>
          )}

          {revenus.length === 0 && <div className="ve-empty">Aucun revenu ce mois</div>}
        </div>

      </div>
    </div>
  );
}
