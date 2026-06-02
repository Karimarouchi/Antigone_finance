/**
 * components/ui/FeatureAssignmentPanel.tsx
 *
 * Two-panel feature assignment UI:
 *   Left  — searchable user list with a granted-count badge per user
 *   Right — feature groups with toggle switches for the selected user
 *
 * onGrant / onRevoke are props so the component works in both the admin
 * and super-admin contexts with their respective server actions.
 */

import { useOptimistic, useTransition, useState, useMemo } from 'react'
import './feature-assignment-panel.css'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface FAPUser {
  id:         string
  email:      string
  full_name:  string | null
  avatar_url?: string | null
}

export interface FAPFeatureItem {
  id:           string
  label:        string
  description?: string
}

export interface FAPFeatureGroup {
  id:    string
  label: string
  items: FAPFeatureItem[]
}

export interface FAPGrantSet {
  [key: string]: boolean   // `${userId}::${featureId}` → true
}

type GrantAction = (userId: string, featureId: string) => Promise<{ error?: string }>

interface Props {
  users:         FAPUser[]
  featureGroups: FAPFeatureGroup[]
  grants:        FAPGrantSet
  onGrant:       GrantAction
  onRevoke:      GrantAction
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(user: FAPUser): string {
  if (user.full_name) {
    const parts = user.full_name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return user.email[0].toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

export function FeatureAssignmentPanel({
  users,
  featureGroups,
  grants,
  onGrant,
  onRevoke,
}: Props) {
  const [optimisticGrants, applyOptimistic] = useOptimistic(
    grants,
    (state, { key, value }: { key: string; value: boolean }) => ({
      ...state,
      [key]: value,
    }),
  )

  const [isPending, startTransition] = useTransition()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search,     setSearch]     = useState('')

  const totalFeatures = featureGroups.reduce((n, g) => n + g.items.length, 0)

  const filteredUsers = useMemo(
    () =>
      users.filter(
        (u) =>
          u.email.toLowerCase().includes(search.toLowerCase()) ||
          (u.full_name?.toLowerCase() ?? '').includes(search.toLowerCase()),
      ),
    [users, search],
  )

  const selectedUser = users.find((u) => u.id === selectedId) ?? null

  function grantedCountFor(userId: string): number {
    return featureGroups.reduce(
      (n, g) => n + g.items.filter((item) => optimisticGrants[`${userId}::${item.id}`]).length,
      0,
    )
  }

  function isGranted(featureId: string): boolean {
    if (!selectedId) return false
    return !!optimisticGrants[`${selectedId}::${featureId}`]
  }

  function toggle(featureId: string, currentlyGranted: boolean) {
    if (!selectedId || isPending) return
    const key = `${selectedId}::${featureId}`
    startTransition(async () => {
      applyOptimistic({ key, value: !currentlyGranted })
      if (currentlyGranted) {
        await onRevoke(selectedId, featureId)
      } else {
        await onGrant(selectedId, featureId)
      }
    })
  }

  return (
    <div className="fap-container">

      {/* ── Left: user list ──────────────────────────────────────────────── */}
      <aside className="fap-sidebar">
        <div className="fap-search-wrapper">
          <svg className="fap-search-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
            <path fillRule="evenodd" d="M9 3a6 6 0 100 12A6 6 0 009 3zM1 9a8 8 0 1114.32 4.906l3.387 3.387a1 1 0 01-1.414 1.414l-3.387-3.387A8 8 0 011 9z" clipRule="evenodd"/>
          </svg>
          <input
            type="search"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="fap-search"
            aria-label="Rechercher un utilisateur"
          />
        </div>

        <ul className="fap-user-list" role="listbox" aria-label="Utilisateurs">
          {filteredUsers.map((user) => {
            const count   = grantedCountFor(user.id)
            const active  = selectedId === user.id
            return (
              <li key={user.id} role="option" aria-selected={active}>
                <button
                  className={`fap-user-btn${active ? ' fap-user-btn-active' : ''}`}
                  onClick={() => setSelectedId(user.id)}
                >
                  <span className={`fap-avatar${active ? ' fap-avatar-active' : ''}`}>
                    {user.avatar_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={user.avatar_url} alt="" />
                      : initials(user)
                    }
                  </span>
                  <span className="fap-user-text">
                    <span className="fap-user-name">{user.full_name || user.email}</span>
                    {user.full_name && (
                      <span className="fap-user-email">{user.email}</span>
                    )}
                  </span>
                  <span
                    className={`fap-count-badge${count === totalFeatures ? ' fap-count-full' : count > 0 ? ' fap-count-partial' : ''}`}
                    title={`${count} / ${totalFeatures} accès`}
                  >
                    {count}/{totalFeatures}
                  </span>
                </button>
              </li>
            )
          })}

          {filteredUsers.length === 0 && (
            <li className="fap-no-users">Aucun utilisateur trouvé.</li>
          )}
        </ul>
      </aside>

      {/* ── Right: feature toggles ────────────────────────────────────────── */}
      <div className="fap-main">
        {!selectedUser ? (
          <div className="fap-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <p>Sélectionnez un utilisateur<br />pour gérer ses accès.</p>
          </div>
        ) : (
          <div className="fap-features-wrap">
            <div className="fap-features-header">
              <div className="fap-selected-user">
                <span className="fap-avatar fap-avatar-active fap-avatar-lg">
                  {selectedUser.avatar_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={selectedUser.avatar_url} alt="" />
                    : initials(selectedUser)
                  }
                </span>
                <div>
                  <p className="fap-selected-name">{selectedUser.full_name || selectedUser.email}</p>
                  {selectedUser.full_name && (
                    <p className="fap-selected-email">{selectedUser.email}</p>
                  )}
                </div>
              </div>
              <span className={`fap-summary-badge${isPending ? ' fap-saving' : ''}`}>
                {isPending
                  ? 'Enregistrement…'
                  : `${grantedCountFor(selectedUser.id)} / ${totalFeatures} accès`}
              </span>
            </div>

            <div className="fap-groups">
              {featureGroups.map((group) => (
                <section key={group.id} className="fap-group">
                  <h4 className="fap-group-title">{group.label}</h4>
                  <div className="fap-feature-list">
                    {group.items.map((item) => {
                      const granted = isGranted(item.id)
                      return (
                        <div key={item.id} className="fap-feature-row">
                          <div className="fap-feature-text">
                            <span className="fap-feature-label">{item.label}</span>
                            {item.description && (
                              <span className="fap-feature-desc">{item.description}</span>
                            )}
                          </div>
                          <button
                            role="switch"
                            aria-checked={granted}
                            aria-label={`${item.label} — ${granted ? 'actif' : 'inactif'}`}
                            className={`fap-toggle${granted ? ' fap-toggle-on' : ' fap-toggle-off'}`}
                            onClick={() => toggle(item.id, granted)}
                            disabled={isPending}
                          >
                            <span className="fap-toggle-thumb" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
