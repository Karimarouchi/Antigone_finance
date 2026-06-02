import { useState, useTransition, useEffect } from 'react'
import { useAuth }                             from '@/context/AuthContext'
import { updateProfileInfo }                   from '@/app/(protected)/profile/actions'
import './welcome-modal.css'

const PRESET_AVATARS = [
  '/Avatars/Avatar 1.jpg',
  '/Avatars/Avatar 2.jpg',
  '/Avatars/Avatar 3.jpg',
  '/Avatars/Avatar 4.jpg',
  '/Avatars/Avatar 5.jpg',
  '/Avatars/Avatar 6.jpg',
]

export default function WelcomeModal() {
  const { user, profile, loading, refreshProfile } = useAuth()
  const [visible,  setVisible]            = useState(false)
  const [selected, setSelected]           = useState<string | null>(null)
  const [pending,  startTransition]       = useTransition()

  useEffect(() => {
    if (loading || !user) return
    // Never show if the user already has an avatar
    if (profile?.avatar_url) { setVisible(false); return }
    const key = `welcome_shown_${user.id}`
    if (!localStorage.getItem(key)) setVisible(true)
  }, [loading, user, profile])

  function dismiss() {
    if (!user) return
    localStorage.setItem(`welcome_shown_${user.id}`, '1')
    setVisible(false)
  }

  function handleContinue() {
    startTransition(async () => {
      if (selected) {
        await updateProfileInfo({ avatar_url: selected })
        await refreshProfile()
      }
      dismiss()
    })
  }

  if (!visible || !user) return null

  const firstName = profile?.full_name?.trim().split(' ')[0] ?? null

  return (
    <div className="wm-overlay" role="dialog" aria-modal="true" aria-label="Bienvenue">
      <div className="wm-card">
        <div className="wm-header">
          <div className="wm-logo">✦</div>
          <h2 className="wm-title">
            {firstName ? `Bienvenue, ${firstName} !` : 'Bienvenue sur Antigone Pay !'}
          </h2>
          <p className="wm-subtitle">
            Choisissez un avatar pour personnaliser votre profil.
          </p>
        </div>

        <div className="wm-grid">
          {PRESET_AVATARS.map((src) => (
            <button
              key={src}
              type="button"
              className={`wm-avatar${selected === src ? ' selected' : ''}`}
              onClick={() => setSelected(s => s === src ? null : src)}
              disabled={pending}
              aria-label={`Sélectionner cet avatar`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" />
              {selected === src && (
                <span className="wm-avatar-check">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="wm-actions">
          <button
            type="button"
            className="wm-btn-primary"
            onClick={handleContinue}
            disabled={pending}
          >
            {pending ? 'Enregistrement…' : selected ? 'Continuer' : 'Passer pour l\'instant'}
          </button>
        </div>
      </div>
    </div>
  )
}
