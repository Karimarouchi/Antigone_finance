import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useHistory } from '@/features/invoice/hooks/useHistory';
import { fmtDate, fmt } from '@/features/invoice/utils/format';
import { CustomSelect } from '@/components/ui/custom-select';
import GlowCard from '@/components/GlowCard';

function fmtNum(n: any) {
  return parseFloat(n || 0).toFixed(3).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export default function Dashboard() {
  const { dispatch } = useInvoice();
  const { loadDashboard, loadDashboardClients, deleteHistory, loadPaymentStatuses } = useHistory();
  const navigate = useNavigate();

  const [tab, setTab] = useState('facture');
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [clients, setClients] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ client: '', dateRange: '' });
  const [sort, setSort] = useState({ column: 'num', ascending: true });
  const [paymentStatuses, setPaymentStatuses] = useState<Record<string, { status: string; clientId: string | null }>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const numCol = tab === 'devis' ? 'devis_number' : 'invoice_number';
    const effectiveSort = sort.column === 'num' ? { column: numCol, ascending: sort.ascending } : sort;
    const result = await loadDashboard(tab, filters, effectiveSort);
    setRows(result.rows);
    setStats(result.stats);
    setLoading(false);
  }, [tab, filters, sort, loadDashboard]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    loadDashboardClients(tab).then(setClients);
  }, [tab, loadDashboardClients]);

  useEffect(() => {
    if (tab === 'facture') {
      loadPaymentStatuses().then(setPaymentStatuses);
    }
  }, [tab, loadPaymentStatuses]);

  async function handleDelete(row: any) {
    const docType = tab === 'devis' ? 'devis' : 'facture';
    const label = row[numField] || 'ce document';
    if (!window.confirm(`Supprimer ${label} de l'historique ?`)) return;
    setDeletingId(row.id);
    try {
      await deleteHistory(row.id, docType);
      setRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch {
      alert('Erreur lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleArchive(row: any) {
    const pay = paymentStatuses[row[numField]];
    const clientId = row.client_id ?? row.clientId ?? pay?.clientId;
    if (clientId) {
      navigate(`/about/${clientId}`);
    }
  }

  function toggleSort(col: string) {
    setSort((prev) => prev.column === col
      ? { column: col, ascending: !prev.ascending }
      : { column: col, ascending: col === 'num' }
    );
  }

  function sortIndicator(col: string) {
    if (sort.column !== col) return '';
    return sort.ascending ? ' ▲' : ' ▼';
  }

  const isDevis = tab === 'devis';
  const numField   = isDevis ? 'devis_number' : 'invoice_number';
  const valueField = isDevis ? 'total_ht' : 'total_ttc';

  return (
    <GlowCard borderRadius={60}>
      <div className="dash-panel">
        <button
          type="button"
          className="dash-close"
          aria-label="Fermer"
          onClick={() => dispatch({ type: 'TOGGLE_DASHBOARD' })}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        <div className="dash-tabs-wrap">
          <div className="dash-tabs-pill">
            <button
              type="button"
              className={`dash-pill-btn${tab === 'facture' ? ' active' : ''}`}
              onClick={() => setTab('facture')}
            >
              Factures
            </button>
            <button
              type="button"
              className={`dash-pill-btn${tab === 'devis' ? ' active' : ''}`}
              onClick={() => setTab('devis')}
            >
              Devis
            </button>
          </div>
        </div>

        <div className="dash-stats-grid">
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Documents</div>
            <div className="dashboard-stat-value">{stats.totalCount ?? 0}</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">{isDevis ? 'Total HT' : 'Total TTC'}</div>
            <div className="dashboard-stat-value accent">{fmtNum(stats.totalValue)} DT</div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">Total TVA</div>
            <div className="dashboard-stat-value" style={{ color: '#F46A03', fontWeight: 600 }}>
              {fmtNum(stats.totalTVA)} DT
            </div>
          </div>
          <div className="dashboard-stat-card">
            <div className="dashboard-stat-label">PDF / Drive</div>
            <div className="dashboard-stat-value">{stats.downloadCount ?? 0} / {stats.driveCount ?? 0}</div>
          </div>
        </div>

        <div className="dash-table-card">
          <div className="dash-table-hdr">
            <span className="dash-table-title">Historique</span>
            <div className="dash-filters">
              <div className="dash-filter-csel">
                <CustomSelect
                  value={filters.client}
                  onChange={(v) => setFilters((f) => ({ ...f, client: v }))}
                  options={clients.map((c) => ({ value: c, label: c }))}
                  placeholder="Tous les clients"
                  size="sm"
                />
              </div>
              <div className="dash-filter-csel">
                <CustomSelect
                  value={filters.dateRange}
                  onChange={(v) => setFilters((f) => ({ ...f, dateRange: v }))}
                  options={[
                    { value: 'today', label: "Aujourd'hui" },
                    { value: 'week', label: 'Cette semaine' },
                    { value: 'month', label: 'Ce mois' },
                    { value: 'year', label: 'Cette année' },
                  ]}
                  placeholder="Toutes les dates"
                  size="sm"
                />
              </div>
            </div>
          </div>

          <div className="dash-table-body">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                Chargement...
              </div>
            ) : rows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin: '0 auto 16px', opacity: 0.3, display: 'block' }}>
                  <rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/>
                  <rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>
                </svg>
                <div style={{ fontSize: 14 }}>Aucun document trouvé</div>
                <div style={{ fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>Essayez de modifier les filtres</div>
              </div>
            ) : (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('num')}>
                      N°{sortIndicator('num')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('version')}>
                      Version{sortIndicator('version')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('date_issued')}>
                      Date{sortIndicator('date_issued')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('client_name')}>
                      Client{sortIndicator('client_name')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('total_ttc')}>
                      Total{sortIndicator('total_ttc')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('action_type')}>
                      Action{sortIndicator('action_type')}
                    </th>
                    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => toggleSort('created_at')}>
                      Créé le{sortIndicator('created_at')}
                    </th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => {
                    const num = r[numField];
                    const val = parseFloat(r[valueField] || 0);
                    const createdAt = new Date(r.created_at);
                    const createdStr = createdAt.toLocaleDateString('fr-FR') + ' ' + createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const actions = (r.action_type || '').split(',').filter(Boolean);
                    const ACTION_META: Record<string, { label: string; cls: string }> = {
                      download: { label: 'PDF',   cls: 'download' },
                      drive:    { label: 'Drive', cls: 'drive' },
                      email:    { label: 'Email', cls: 'email' },
                    };
                    const pay = paymentStatuses[num];
                    const isPaid = pay?.status === 'paid';
                    const hasClient = !!(r.client_id ?? r.clientId ?? pay?.clientId);
                    const isDeleting = deletingId === r.id;
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600, color: 'var(--accent)' }}>{num || '-'}</td>
                        <td>
                          <span className="dashboard-version-badge">
                            V{r.version ?? 1}
                          </span>
                        </td>
                        <td>{fmtDate(r.date_issued)}</td>
                        <td style={{ fontWeight: 500 }}>{r.client_name || '-'}</td>
                        <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtNum(val)} DT</td>
                        <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {actions.map((a: string) => {
                            const meta = ACTION_META[a] || { label: a, cls: 'download' };
                            return <span key={a} className={`dashboard-action-badge ${meta.cls}`}>{meta.label}</span>;
                          })}
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--accent-light)', fontSize: 12 }}>{createdStr}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {isPaid && hasClient && (
                              <button
                                type="button"
                                onClick={() => handleArchive(r)}
                                style={{
                                  padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                  background: 'rgba(34,197,94,0.12)', color: '#16a34a',
                                  fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
                                }}
                              >
                                Archiver
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDelete(r)}
                              style={{
                                padding: '3px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                                background: 'rgba(239,68,68,0.12)', color: '#dc2626',
                                fontSize: 12, fontWeight: 600, opacity: isDeleting ? 0.5 : 1,
                              }}
                            >
                              {isDeleting ? '…' : 'Supprimer'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </GlowCard>
  );
}
