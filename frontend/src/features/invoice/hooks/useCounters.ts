import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { nextNumber, todayISO } from '@/features/invoice/utils/format';

export function useCounters() {
  const { state, dispatch } = useInvoice();

  const loadCounters = useCallback(async () => {
    try {
      const res = await api.get('/api/counters');
      const data: any[] = res.data;
      const lastNumbers: Record<string, string> = {};
      data.forEach((row: any) => {
        lastNumbers[row.type] = row.lastNumber || '';
      });
      dispatch({ type: 'SET_LAST_NUMBERS', value: lastNumbers });

      if (!state.isLocked) {
        const dbType  = state.docType === 'Devis' ? 'devis' : 'facture';
        const last    = lastNumbers[dbType] || '';
        const parts   = last.split('-');
        const year    = new Date().getFullYear().toString();
        const seq     = parseInt(parts[1], 10);
        const docNum  = (parts[0] === year && !isNaN(seq))
          ? `${year}-${seq + 1}`
          : `${year}-1`;
        dispatch({ type: 'SET_FIELD', key: 'docNum',    value: docNum });
        dispatch({ type: 'SET_FIELD', key: 'docDate',   value: todayISO() });
        dispatch({ type: 'SET_FIELD', key: 'isLocked',  value: true });
      }
    } catch (err) {
      console.error('loadCounters:', err);
    }
  }, [dispatch, state.docType]);

  const saveCounter = useCallback(async (dbType: string, num: string) => {
    try {
      await api.put(`/api/counters/${dbType}`, { lastNumber: num });
    } catch (err) {
      console.error('saveCounter:', err);
    }
  }, []);

  const advanceDocNum = useCallback((dbType: string) => {
    const newNum = nextNumber(dbType, state.lastNumbers);
    dispatch({ type: 'SET_FIELD', key: 'docNum', value: newNum });
    return newNum;
  }, [state.lastNumbers, dispatch]);

  return { loadCounters, saveCounter, advanceDocNum };
}
