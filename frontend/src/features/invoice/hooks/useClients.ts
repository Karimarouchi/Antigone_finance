import { useCallback } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';

/* The API returns clients in camelCase; the invoice components read snake_case.
   Normalize so both shapes are available. */
function normalizeClient(c: any) {
  if (!c) return c;
  return {
    ...c,
    commercial_name:       c.commercial_name       ?? c.commercialName       ?? null,
    matricule_fiscale:     c.matricule_fiscale     ?? c.matriculeFiscale     ?? null,
    joining_date:          c.joining_date          ?? c.joiningDate          ?? null,
    billing_cycle:         c.billing_cycle         ?? c.billingCycle         ?? null,
    logo_url:              c.logo_url              ?? c.logoUrl              ?? null,
    email_receiver_name:   c.email_receiver_name   ?? c.emailReceiverName   ?? null,
    email_receiver_gender: c.email_receiver_gender ?? c.emailReceiverGender ?? null,
  };
}

export function useClients() {
  const { dispatch } = useInvoice();

  const loadClients = useCallback(async () => {
    try {
      const res = await api.get('/api/clients');
      return (res.data || []).map(normalizeClient);
    } catch (err) {
      console.error('loadClients:', err);
      return [];
    }
  }, []);

  const selectClient = useCallback(async (id: string | null) => {
    if (!id) {
      dispatch({ type: 'SET_FIELD', key: 'currentClient', value: null });
      return null;
    }
    try {
      const res = await api.get(`/api/clients/${id}`);
      const client = normalizeClient(res.data);
      dispatch({ type: 'SET_FIELD', key: 'currentClient', value: client });
      return client;
    } catch (err) {
      console.error('selectClient:', err);
      return null;
    }
  }, [dispatch]);

  const saveNewClient = useCallback(async ({ name, matriculeFiscale, joiningDate, billingCycle, email, logoFile }: any) => {
    if (!name?.trim()) return null;
    try {
      let logo_url: string | null = null;

      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        try {
          const uploadRes = await api.post('/api/client-logos', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          logo_url = uploadRes.data?.url || null;
        } catch {
          // logo upload failed — continue without logo
        }
      }

      const payload = {
        name:             name.trim(),
        matriculeFiscale: matriculeFiscale || null,
        joiningDate:      joiningDate || null,
        billingCycle:     billingCycle || null,
        email:            email?.trim() || null,
        logoUrl:          logo_url,
      };

      const res = await api.post('/api/clients', payload);
      return normalizeClient(res.data);
    } catch (err) {
      console.error('saveNewClient:', err);
      return null;
    }
  }, []);

  const editClient = useCallback(async (id: string, { name, matriculeFiscale, joiningDate, billingCycle, email, logoFile }: any) => {
    try {
      const payload: any = {
        name:             name?.trim(),
        matriculeFiscale: matriculeFiscale || null,
        joiningDate:      joiningDate || null,
        billingCycle:     billingCycle || null,
        email:            email?.trim() || null,
      };

      if (logoFile) {
        const formData = new FormData();
        formData.append('file', logoFile);
        try {
          const uploadRes = await api.post('/api/client-logos', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          payload.logoUrl = uploadRes.data?.url || null;
        } catch {
          // logo upload failed — skip
        }
      }

      const res = await api.put(`/api/clients/${id}`, payload);
      const client = normalizeClient(res.data);
      dispatch({ type: 'SET_FIELD', key: 'currentClient', value: client });
      return client;
    } catch (err) {
      console.error('editClient:', err);
      return null;
    }
  }, [dispatch]);

  const deleteClient = useCallback(async (id: string) => {
    try {
      await api.delete(`/api/clients/${id}`);
      dispatch({ type: 'SET_FIELD', key: 'currentClient', value: null });
      return true;
    } catch (err) {
      console.error('deleteClient:', err);
      return false;
    }
  }, [dispatch]);

  return { loadClients, selectClient, saveNewClient, editClient, deleteClient };
}
