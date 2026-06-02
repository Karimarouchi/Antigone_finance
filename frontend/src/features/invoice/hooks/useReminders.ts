import { useCallback, useEffect } from 'react';
import { api } from '@/lib/api';
import { useInvoice } from '@/features/invoice/context/InvoiceContext';

const CYCLE_MONTHS: Record<string, number> = {
  monthly:       1,
  quarterly:     3,
  'semi-annual': 6,
  yearly:        12,
};

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function calculateNextPaymentDate(joiningDate: string, billingCycle: string): string | null {
  if (!joiningDate || !billingCycle || billingCycle === 'one_shot') return null;
  const months = CYCLE_MONTHS[billingCycle];
  if (!months) return null;

  const joining = new Date(joiningDate);
  const now     = new Date();
  let next      = new Date(joining);

  while (next <= now) {
    next = addMonths(next, months);
  }
  return next.toISOString().slice(0, 10);
}

function daysUntilPayment(paymentDate: string): number {
  const now  = new Date();
  now.setHours(0, 0, 0, 0);
  const pay  = new Date(paymentDate);
  pay.setHours(0, 0, 0, 0);
  return Math.round((pay.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getRemindersToShow(reminders: any[], clients: any[]): any {
  const now = new Date();

  const eligible = reminders.filter((r) => {
    const days = daysUntilPayment(r.next_payment_date);
    if (days < 0) return false;
    if (r.confirmation_status === 'confirmed') return false;
    if (r.last_denied_at) {
      const deniedAt = new Date(r.last_denied_at);
      const hoursSince = (now.getTime() - deniedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 24) return false;
    }
    if (days <= 1  && !r.reminder_1_day_shown)  return true;
    if (days <= 5  && !r.reminder_5_days_shown)  return true;
    if (days <= 10 && !r.reminder_10_days_shown) return true;
    return false;
  });

  if (!eligible.length) return null;

  const byDays: Record<number, any[]> = {};
  eligible.forEach((r) => {
    const days = daysUntilPayment(r.next_payment_date);
    const key  = days <= 1 ? 1 : days <= 5 ? 5 : 10;
    if (!byDays[key]) byDays[key] = [];
    byDays[key].push(r);
  });

  const minKey = Math.min(...Object.keys(byDays).map(Number));
  const group  = byDays[minKey];
  const clientIds = group.map((r: any) => r.client_id);
  const groupClients = clients.filter((c: any) => clientIds.includes(c.id));

  return { reminders: group, clients: groupClients, daysLeft: minKey };
}

export function useReminders() {
  const { dispatch } = useInvoice();

  const checkAndDisplayReminders = useCallback(async () => {
    try {
      const clientsRes = await api.get('/api/clients');
      const clients: any[] = (clientsRes.data || []).filter((c: any) => c.billing_cycle);
      if (!clients.length) return;

      // Upsert reminder records for each client via backend
      for (const client of clients) {
        const nextDate = calculateNextPaymentDate(client.joining_date, client.billing_cycle);
        if (!nextDate) continue;
        try {
          await api.post('/api/client-reminders', {
            client_id:              client.id,
            next_payment_date:      nextDate,
            reminder_10_days_shown: false,
            reminder_5_days_shown:  false,
            reminder_1_day_shown:   false,
            confirmation_status:    null,
          });
        } catch {
          // Already exists — ignore conflict
        }
      }

      const remindersRes = await api.get('/api/client-reminders');
      const reminders: any[] = remindersRes.data || [];

      const group = getRemindersToShow(reminders, clients);
      dispatch({ type: 'SET_ACTIVE_REMINDER', value: group });
    } catch (err) {
      console.error('checkAndDisplayReminders:', err);
    }
  }, [dispatch]);

  const handleReminderConfirm = useCallback(async (activeReminder: any) => {
    if (!activeReminder) return;
    const ids: string[] = activeReminder.reminders.map((r: any) => r.id);
    try {
      for (const id of ids) {
        await api.delete(`/api/client-reminders/${id}`);
      }
    } catch (err) {
      console.error('handleReminderConfirm:', err);
    }
    dispatch({ type: 'SET_ACTIVE_REMINDER', value: null });
  }, [dispatch]);

  const handleReminderDeny = useCallback(async (activeReminder: any) => {
    if (!activeReminder) return;
    const { daysLeft } = activeReminder;
    const flagField =
      daysLeft <= 1 ? 'reminder_1_day_shown'
      : daysLeft <= 5 ? 'reminder_5_days_shown'
      : 'reminder_10_days_shown';

    const ids: string[] = activeReminder.reminders.map((r: any) => r.id);
    try {
      for (const id of ids) {
        await api.put(`/api/client-reminders/${id}`, {
          [flagField]: true,
          last_denied_at: new Date().toISOString(),
          confirmation_status: 'denied',
        });
      }
    } catch (err) {
      console.error('handleReminderDeny:', err);
    }
    dispatch({ type: 'SET_ACTIVE_REMINDER', value: null });
  }, [dispatch]);

  useEffect(() => {
    checkAndDisplayReminders();
    const interval = setInterval(checkAndDisplayReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [checkAndDisplayReminders]);

  return { checkAndDisplayReminders, handleReminderConfirm, handleReminderDeny };
}
