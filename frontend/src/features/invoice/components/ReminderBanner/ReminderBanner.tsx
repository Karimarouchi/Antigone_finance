import { useInvoice } from '@/features/invoice/context/InvoiceContext';
import { useReminders } from '@/features/invoice/hooks/useReminders';

export default function ReminderBanner() {
  const { state, dispatch } = useInvoice();
  const { handleReminderConfirm, handleReminderDeny } = useReminders();
  const { activeReminder, reminderExpanded } = state;

  if (!activeReminder) return null;

  const { clients, daysLeft } = activeReminder;
  const names = clients.map((c: any) => c.name).join(', ');
  const title = daysLeft <= 1
    ? 'Paiement demain !'
    : `Paiement dans ${daysLeft} jours`;
  const message = names;

  return (
    <div className="reminder-banner">
      <div className="reminder-box">
        <div className="reminder-compact">
          <div className="reminder-icon">
            <svg className="reminder-icon-svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <div className="reminder-text">
            <div className="reminder-app-name">ANTIGONE PAY</div>
            <div className="reminder-text-title">{title}</div>
            <div className="reminder-text-subtitle">{message}</div>
          </div>
          <button
            className="reminder-expand-btn"
            aria-label="Expand"
            onClick={() => dispatch({ type: 'SET_REMINDER_EXPANDED', value: !reminderExpanded })}
          >
            <svg
              viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"
              style={{ transform: reminderExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>

        {reminderExpanded && (
          <div className="reminder-actions">
            <button
              className="reminder-btn reminder-btn-confirm"
              onClick={() => handleReminderConfirm(activeReminder)}
            >
              ✓ Confirmer
            </button>
            <button
              className="reminder-btn reminder-btn-deny"
              onClick={() => handleReminderDeny(activeReminder)}
            >
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
