import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { INITIAL_SM_STATE } from '@/features/invoice/constants/socialMedia';

export function useTemplates() {
  const { state, dispatch } = useInvoice();

  const captureState = useCallback(() => {
    return {
      docType:       state.docType,
      svcTitle:      state.svcTitle,
      svcSubtitle:   state.svcSubtitle,
      selectedSM:    { ...state.selectedSM },
      emptyBarCount: state.emptyBarCount,
      iHT:           state.iHT,
      iTVA:          state.iTVA,
      iTimbre:       state.iTimbre,
      catsSelected:  state.cats.map((c: any) => ({ id: c.id, selected: c.selected })),
    };
  }, [state]);

  const applyState = useCallback((saved: any) => {
    const restoredCats = state.cats.map((c: any) => {
      const found = (saved.catsSelected || []).find((s: any) => s.id === c.id);
      return { ...c, selected: found ? found.selected : [], _open: false };
    });

    dispatch({
      type: 'APPLY_TEMPLATE',
      state: {
        docType:       saved.docType      ?? state.docType,
        svcTitle:      saved.svcTitle     ?? state.svcTitle,
        svcSubtitle:   saved.svcSubtitle  ?? state.svcSubtitle,
        selectedSM:    saved.selectedSM   ?? { ...INITIAL_SM_STATE },
        emptyBarCount: saved.emptyBarCount ?? 0,
        iHT:           saved.iHT          ?? 0,
        iTVA:          saved.iTVA         ?? 19,
        iTimbre:       saved.iTimbre      ?? 1,
        cats:          restoredCats,
      },
    });
  }, [state.cats, state.docType, state.svcTitle, state.svcSubtitle, dispatch]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await api.get('/api/templates');
      return res.data || [];
    } catch (err) {
      console.error('loadTemplates:', err);
      return [];
    }
  }, []);

  const saveTemplate = useCallback(async (name: string) => {
    try {
      // Check for duplicate
      const all = await api.get('/api/templates');
      const exists = (all.data || []).some((t: any) => t.name === name.trim());
      if (exists) return { error: 'duplicate' };

      const templateData = captureState();
      const res = await api.post('/api/templates', { name: name.trim(), data: templateData });
      return res.data;
    } catch (err) {
      console.error('saveTemplate:', err);
      return null;
    }
  }, [captureState]);

  const renameTemplate = useCallback(async (id: string, newName: string) => {
    try {
      await api.put(`/api/templates/${id}`, { name: newName.trim() });
      return true;
    } catch (err) {
      console.error('renameTemplate:', err);
      return false;
    }
  }, []);

  const deleteTemplate = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/templates/${id}`);
      return true;
    } catch (err) {
      console.error('deleteTemplate:', err);
      return false;
    }
  }, []);

  return { captureState, applyState, loadTemplates, saveTemplate, renameTemplate, deleteTemplate };
}
