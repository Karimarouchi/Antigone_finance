import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { calcServiceSum } from '@/features/invoice/utils/format';

export function useHistory() {
  const { state } = useInvoice();

  const getTable = (docType: string) =>
    docType === 'Devis' ? 'devis_history' : 'facture_history';

  const getNumField = (docType: string) =>
    docType === 'Devis' ? 'devis_number' : 'invoice_number';

  const checkActionForVersion = useCallback(async (
    docType: string, num: string, action: string, version: number
  ): Promise<boolean> => {
    try {
      const endpoint = `/api/${getTable(docType)}`;
      const res = await api.get(endpoint, { params: { [getNumField(docType)]: num, version } });
      const data: any[] = res.data;
      if (!data || data.length === 0) return false;
      return (data[0].action_type || '').split(',').map((s: string) => s.trim()).includes(action);
    } catch {
      return false;
    }
  }, []);

  const checkAlreadyDownloaded   = useCallback((docType: string, num: string) => checkActionForVersion(docType, num, 'download', 1), [checkActionForVersion]);
  const checkAlreadySavedToDrive = useCallback((docType: string, num: string) => checkActionForVersion(docType, num, 'drive',    1), [checkActionForVersion]);
  const checkAlreadySentByEmail  = useCallback((docType: string, num: string) => checkActionForVersion(docType, num, 'email',    1), [checkActionForVersion]);

  const getUsedVersions = useCallback(async (docType: string, num: string): Promise<number[]> => {
    try {
      const endpoint = `/api/${getTable(docType)}`;
      const res = await api.get(endpoint, { params: { [getNumField(docType)]: num } });
      const data: any[] = res.data;
      if (!data) return [];
      return [...new Set(data.map((r: any) => Number(r.version || 1)))];
    } catch {
      return [];
    }
  }, []);

  const saveToHistory = useCallback(async (
    actionType: string,
    options: { docNum?: string; version?: number } = {}
  ) => {
    const {
      docType, docNum: stateDocNum, docDate, currentClient, cats, iHT, iTVA, iTimbre,
      selectedSM, svcTitle, svcSubtitle, emptyBarCount, email, address, showStamp,
    } = state;
    const docNum  = options.docNum  ?? stateDocNum;
    const version = (typeof options.version === 'number' && options.version >= 1) ? options.version : 1;
    const isDevis = docType === 'Devis';

    const serviceSum = calcServiceSum(cats);
    const ht         = Math.max(serviceSum, parseFloat(String(iHT)) || 0);
    const tvaAmt     = isDevis ? 0 : ht * (parseFloat(String(iTVA)) || 0) / 100;
    const timbre     = isDevis ? 0 : parseFloat(String(iTimbre)) || 0;
    const ttc        = ht + tvaAmt + timbre;

    const res = await fetch('/api/save-history', {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(() => {
          try {
            const a = JSON.parse(localStorage.getItem('finace:auth') || '{}');
            return a.accessToken ? { Authorization: `Bearer ${a.accessToken}` } : {};
          } catch { return {}; }
        })(),
      } as Record<string, string>,
      body: JSON.stringify({
        docType,
        docNum,
        clientId:        currentClient?.id        || null,
        clientName:      currentClient?.name       || '',
        clientMatricule: currentClient?.matricule_fiscale || '',
        dateIssued:      docDate || null,
        ht,
        ttc,
        tvaAmt,
        timbre,
        actionType,
        version,
        payload: {
          docType, docDate, currentClient,
          cats, selectedSM, svcTitle, svcSubtitle,
          emptyBarCount, iHT, iTVA, iTimbre,
          email, address, showStamp,
        },
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `save-history HTTP ${res.status}`);
    }
  }, [state]);

  const loadDashboard = useCallback(async (
    tab: string,
    filters: any = {},
    sort: { column: string; ascending: boolean } = { column: 'created_at', ascending: false }
  ) => {
    try {
      const endpoint = tab === 'devis' ? '/api/devis-history' : '/api/facture-history';
      const numField = tab === 'devis' ? 'devis_number' : 'invoice_number';
      const res = await api.get(endpoint);
      const raw: any[] = res.data || [];
      // Normalize camelCase (backend) → snake_case (frontend)
      let rows: any[] = raw.map((r: any) => ({
        ...r,
        invoice_number: r.invoice_number ?? r.invoiceNumber ?? '',
        devis_number:   r.devis_number   ?? r.devisNumber   ?? '',
        client_name:    r.client_name    ?? r.clientName    ?? '',
        date_issued:    r.date_issued    ?? (Array.isArray(r.dateIssued)
                          ? `${r.dateIssued[0]}-${String(r.dateIssued[1]).padStart(2,'0')}-${String(r.dateIssued[2]).padStart(2,'0')}`
                          : r.dateIssued) ?? null,
        total_ht:       Number(r.total_ht  ?? r.totalHt  ?? 0),
        total_ttc:      Number(r.total_ttc ?? r.totalTtc ?? 0),
        total_tva:      Number(r.total_tva ?? r.totalTva ?? 0),
        tva_amount:     Number(r.tva_amount ?? r.tvaAmount ?? r.total_tva ?? r.totalTva ?? 0),
        action_type:    r.action_type ?? r.actionType ?? '',
        created_at:     (() => {
          const v = r.created_at ?? r.createdAt;
          if (v == null) return null;
          if (typeof v === 'number') return new Date(v * (v < 1e12 ? 1000 : 1)).toISOString();
          return v;
        })(),
        version:        Number(r.version ?? 1),
      }));

      // Client-side filtering
      if (filters.client) {
        rows = rows.filter((r: any) => r.client_name === filters.client);
      }
      if (filters.dateRange) {
        const now  = new Date();
        let startDate: Date | null = null;
        if (filters.dateRange === 'today') {
          startDate = new Date(now.toISOString().slice(0, 10));
        } else if (filters.dateRange === 'week') {
          const d = new Date(now); d.setDate(d.getDate() - 7); startDate = d;
        } else if (filters.dateRange === 'month') {
          startDate = new Date(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
        } else if (filters.dateRange === 'year') {
          startDate = new Date(`${now.getFullYear()}-01-01`);
        }
        if (startDate) {
          rows = rows.filter((r: any) => r.date_issued && new Date(r.date_issued) >= startDate!);
        }
      }

      // Sorting
      const sortCol = sort.column;
      const sortDir = sort.ascending ? 1 : -1;
      const parseDocNum = (s: string): number => {
        const parts = String(s || '').split('-');
        if (parts.length === 2) {
          const year = parseInt(parts[0], 10);
          const seq  = parseInt(parts[1], 10);
          if (!isNaN(year) && !isNaN(seq)) return year * 100000 + seq;
        }
        return 0;
      };
      rows.sort((a: any, b: any) => {
        const av = a[sortCol] ?? '';
        const bv = b[sortCol] ?? '';
        if (sortCol === 'invoice_number' || sortCol === 'devis_number') {
          return (parseDocNum(av) - parseDocNum(bv)) * sortDir;
        }
        if (av < bv) return -sortDir;
        if (av > bv) return sortDir;
        return 0;
      });

      // Stats (latest version per docNum)
      const latestByNum: Record<string, any> = {};
      rows.forEach((r: any) => {
        const num = r[numField];
        const v   = r.version ?? 1;
        if (!latestByNum[num] || v > (latestByNum[num].version ?? 1)) latestByNum[num] = r;
      });
      const latestRows = Object.values(latestByNum);

      const totalCount    = latestRows.length;
      const totalValue    = latestRows.reduce((s: number, r: any) => s + (r.total_ttc  || 0), 0);
      const totalTVA      = latestRows.reduce((s: number, r: any) => s + (r.tva_amount || 0), 0);
      const downloadCount = latestRows.filter((r: any) => (r.action_type || '').split(',').includes('download')).length;
      const driveCount    = latestRows.filter((r: any) => (r.action_type || '').split(',').includes('drive')).length;

      return { rows, stats: { totalCount, totalValue, totalTVA, downloadCount, driveCount } };
    } catch (err) {
      console.error('loadDashboard:', err);
      return { rows: [], stats: {} };
    }
  }, []);

  const deleteHistory = useCallback(async (id: string, docType: 'facture' | 'devis') => {
    const endpoint = docType === 'devis'
      ? `/api/devis-history/${id}`
      : `/api/facture-history/${id}`;
    await api.delete(endpoint);
  }, []);

  const loadPaymentStatuses = useCallback(async (): Promise<Record<string, { status: string; clientId: string | null }>> => {
    try {
      const res = await api.get('/api/payments');
      const data: any[] = res.data || [];
      const map: Record<string, { status: string; clientId: string | null }> = {};
      data.forEach((p: any) => {
        const num = p.invoiceNumber ?? p.invoice_number;
        if (num) map[num] = { status: p.status, clientId: p.clientId ?? p.client_id ?? null };
      });
      return map;
    } catch {
      return {};
    }
  }, []);

  const loadDashboardClients = useCallback(async (tab: string) => {
    try {
      const endpoint = tab === 'devis' ? '/api/devis-history' : '/api/facture-history';
      const res = await api.get(endpoint);
      const data: any[] = res.data || [];
      return [...new Set(data.map((r: any) => r.client_name ?? r.clientName).filter(Boolean))].sort() as string[];
    } catch {
      return [];
    }
  }, []);

  return {
    checkActionForVersion,
    checkAlreadyDownloaded,
    checkAlreadySavedToDrive,
    checkAlreadySentByEmail,
    getUsedVersions,
    saveToHistory,
    loadDashboard,
    loadDashboardClients,
    deleteHistory,
    loadPaymentStatuses,
  };
}
