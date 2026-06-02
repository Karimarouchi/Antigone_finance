import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';

export function useServices() {
  const { dispatch } = useInvoice();

  const loadSavedServices = useCallback(async () => {
    try {
      const res = await api.get('/api/services');
      const rows: any[] = res.data;
      dispatch({ type: 'MERGE_SAVED_SERVICES', rows });
    } catch (err) {
      console.error('loadSavedServices:', err);
    }
  }, [dispatch]);

  const saveService = useCallback(async (categoryId: string, name: string) => {
    try {
      const res = await api.post('/api/services', { category_id: categoryId, name });
      const data = res.data;
      dispatch({ type: 'ADD_TO_LIBRARY', catId: categoryId, name, uuid: data.id });
      return data;
    } catch (err) {
      console.error('saveService:', err);
      return null;
    }
  }, [dispatch]);

  const editService = useCallback(async (uuid: string, categoryId: string, oldName: string, newName: string) => {
    try {
      await api.put(`/api/services/${uuid}`, { name: newName });
      dispatch({ type: 'UPDATE_IN_LIBRARY', catId: categoryId, oldName, newName });
      return true;
    } catch (err) {
      console.error('editService:', err);
      return false;
    }
  }, [dispatch]);

  const deleteService = useCallback(async (uuid: string, categoryId: string, name: string) => {
    try {
      await api.delete(`/api/services/${uuid}`);
      dispatch({ type: 'REMOVE_FROM_LIBRARY', catId: categoryId, name });
      return true;
    } catch (err) {
      console.error('deleteService:', err);
      return false;
    }
  }, [dispatch]);

  return { loadSavedServices, saveService, editService, deleteService };
}
