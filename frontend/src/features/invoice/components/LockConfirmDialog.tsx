interface Props {
  docNum: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LockConfirmDialog({ docNum, onConfirm, onCancel }: Props) {
  return (
    <div className="lock-dlg-overlay" onClick={onCancel}>
      <div className="lock-dlg-card" onClick={(e) => e.stopPropagation()}>
        <div className="lock-dlg-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0110 0v4"/>
          </svg>
        </div>
        <div className="lock-dlg-title">Numéro verrouillé</div>
        <div className="lock-dlg-body">
          Le numéro <strong>{docNum}</strong> a été généré automatiquement et est verrouillé pour éviter les doublons.
          <br /><br />Voulez-vous quand même le modifier ?
        </div>
        <div className="lock-dlg-footer">
          <button className="lock-dlg-btn lock-dlg-btn--cancel" onClick={onCancel}>
            Annuler
          </button>
          <button className="lock-dlg-btn lock-dlg-btn--confirm" onClick={onConfirm}>
            Modifier quand même
          </button>
        </div>
      </div>
    </div>
  );
}
