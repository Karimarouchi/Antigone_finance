import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { APP_REGISTRY } from '@/config/features'
import { FeatureAssignmentPanel } from '@/components/ui/FeatureAssignmentPanel'
import type { FAPUser, FAPFeatureGroup, FAPGrantSet } from '@/components/ui/FeatureAssignmentPanel'

// ── Types ──────────────────────────────────────────────────────────────────────

interface UserView {
  id: string
  email: string
  fullName: string | null
  avatarUrl: string | null
  role: string
  disabled: boolean
  bannedUntil: string | null
  provider: string
  createdAt: string
  features: string[]
}

interface InviteCode {
  id: string
  code: string
  label: string | null
  createdAt: string
  expiresAt: string | null
  usedAt: string | null
  usedBy: string | null
}

// ── Feature groups ─────────────────────────────────────────────────────────────

const FEATURE_GROUPS: FAPFeatureGroup[] = [
  {
    id: 'general',
    label: 'Accès généraux',
    items: APP_REGISTRY.standalone
      .filter(s => !['home', 'super-admin', 'admin'].includes(s.id))
      .map(s => ({ id: s.id, label: s.label, description: s.description })),
  },
  ...APP_REGISTRY.groups.map(g => ({
    id: g.id,
    label: g.label,
    items: g.features.map(f => ({ id: f.id, label: f.label, description: f.description })),
  })),
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  const map: Record<string, string> = {
    super_admin: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    admin:       'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    user:        'bg-zinc-500/15 text-zinc-400 border border-zinc-500/20',
  }
  const labels: Record<string, string> = { super_admin: 'Super Admin', admin: 'Admin', user: 'Utilisateur' }
  const cls = map[role] ?? map.user
  const label = labels[role] ?? role
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [users,   setUsers]   = useState<UserView[]>([])
  const [invites, setInvites] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [usersRes, invitesRes] = await Promise.all([
        api.get<UserView[]>('/api/admin/users'),
        api.get<InviteCode[]>('/api/admin/invites'),
      ])
      setUsers(usersRes.data)
      setInvites(invitesRes.data)
    } catch {
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Feature grant/revoke ───────────────────────────────────────────────────

  const onGrant = async (userId: string, featureId: string) => {
    try {
      await api.post(`/api/me/features/admin/${userId}/${featureId}`)
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, features: u.features.includes(featureId) ? u.features : [...u.features, featureId] }
        : u))
      return {}
    } catch (e: any) {
      return { error: e.response?.data?.message ?? 'Erreur lors de l\'attribution' }
    }
  }

  const onRevoke = async (userId: string, featureId: string) => {
    try {
      await api.delete(`/api/me/features/admin/${userId}/${featureId}`)
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, features: u.features.filter(f => f !== featureId) }
        : u))
      return {}
    } catch (e: any) {
      return { error: e.response?.data?.message ?? 'Erreur lors de la révocation' }
    }
  }

  // ── Disable toggle ─────────────────────────────────────────────────────────

  const toggleDisabled = async (userId: string, current: boolean) => {
    try {
      await api.patch(`/api/admin/users/${userId}/disabled`, { disabled: !current })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, disabled: !current } : u))
    } catch {
      alert('Impossible de modifier le statut')
    }
  }

  // ── Grants map ─────────────────────────────────────────────────────────────

  const grants: FAPGrantSet = {}
  for (const u of users) {
    for (const f of u.features) {
      grants[`${u.id}::${f}`] = true
    }
  }

  const fapUsers: FAPUser[] = users.map(u => ({
    id:        u.id,
    email:     u.email,
    full_name: u.fullName,
    avatar_url: u.avatarUrl,
  }))

  if (loading) return <div className="flex items-center justify-center min-h-screen opacity-50">Chargement…</div>
  if (error)   return <div className="p-8 text-red-400">{error}</div>

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-8 max-w-6xl mx-auto">

      {/* Header */}
      <header>
        <h1 className="text-2xl font-semibold">Administration</h1>
        <p className="text-sm opacity-60 mt-1">Gérez les utilisateurs et leurs accès aux fonctionnalités.</p>
      </header>

      {/* ── Users ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h2 className="font-medium">Utilisateurs</h2>
            <p className="text-xs opacity-50 mt-0.5">{users.length} compte{users.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs opacity-50 uppercase tracking-wide">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3">Email / Nom</th>
                <th className="text-left px-4 py-3">Rôle</th>
                <th className="text-left px-4 py-3">Inscrit le</th>
                <th className="text-left px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${user.disabled ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{user.email}</div>
                    {user.fullName && <div className="text-xs opacity-50">{user.fullName}</div>}
                  </td>
                  <td className="px-4 py-3">{roleBadge(user.role)}</td>
                  <td className="px-4 py-3 opacity-60">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleDisabled(user.id, user.disabled)}
                      className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                        user.disabled
                          ? 'bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30'
                          : 'bg-green-500/15 text-green-400 border-green-500/20 hover:bg-green-500/25'
                      }`}
                    >
                      {user.disabled ? 'Désactivé' : 'Actif'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Invite Codes ── */}
      <InviteSection invites={invites} onRefresh={load} />

      {/* ── Feature Assignment ── */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="font-medium">Attribution des accès</h2>
          <p className="text-xs opacity-50 mt-0.5">Gérez les fonctionnalités accessibles pour chaque utilisateur.</p>
        </div>
        <div className="p-5">
          {users.length === 0 ? (
            <p className="text-sm opacity-50">Aucun utilisateur.</p>
          ) : (
            <FeatureAssignmentPanel
              users={fapUsers}
              featureGroups={FEATURE_GROUPS}
              grants={grants}
              onGrant={onGrant}
              onRevoke={onRevoke}
            />
          )}
        </div>
      </section>
    </div>
  )
}

// ── Invite Code Manager ────────────────────────────────────────────────────────

function InviteSection({ invites, onRefresh }: { invites: InviteCode[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [label,    setLabel]    = useState('')
  const [expires,  setExpires]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setErr(null)
    try {
      await api.post('/api/admin/invites', {
        label:     label || null,
        expiresAt: expires ? new Date(expires).toISOString() : null,
        features:  [],
      })
      setLabel('')
      setExpires('')
      setShowForm(false)
      onRefresh()
    } catch (e: any) {
      setErr(e.response?.data?.message ?? 'Erreur lors de la création')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce code d\'invitation ?')) return
    try {
      await api.delete(`/api/admin/invites/${id}`)
      onRefresh()
    } catch {
      alert('Impossible de supprimer le code')
    }
  }

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div>
          <h2 className="font-medium">Codes d'invitation</h2>
          <p className="text-xs opacity-50 mt-0.5">{invites.length} code{invites.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setErr(null) }}
          className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
        >
          {showForm ? 'Annuler' : '+ Nouveau code'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="px-5 py-4 border-b border-white/10 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs opacity-60">Libellé (optionnel)</span>
              <input
                type="text"
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="ex : Partenaire agence"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </label>
            <label className="block">
              <span className="text-xs opacity-60">Expiration (optionnel)</span>
              <input
                type="date"
                value={expires}
                onChange={e => setExpires(e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </label>
          </div>
          {err && <p className="text-red-400 text-sm">{err}</p>}
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {saving ? 'Création…' : 'Créer le code'}
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        {invites.length === 0 ? (
          <p className="px-5 py-4 text-sm opacity-50">Aucun code d'invitation.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs opacity-50 uppercase tracking-wide">
              <tr className="border-b border-white/10">
                <th className="text-left px-5 py-3">Code</th>
                <th className="text-left px-4 py-3">Libellé</th>
                <th className="text-left px-4 py-3">Créé le</th>
                <th className="text-left px-4 py-3">Expiration</th>
                <th className="text-left px-4 py-3">Utilisé</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => (
                <tr key={inv.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${inv.usedAt ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <code className="font-mono text-xs bg-white/10 px-2 py-0.5 rounded">{inv.code}</code>
                  </td>
                  <td className="px-4 py-3 opacity-70">{inv.label ?? '—'}</td>
                  <td className="px-4 py-3 opacity-60">{formatDate(inv.createdAt)}</td>
                  <td className="px-4 py-3 opacity-60">{formatDate(inv.expiresAt)}</td>
                  <td className="px-4 py-3">
                    {inv.usedAt
                      ? <span className="text-xs text-green-400">✓ {formatDate(inv.usedAt)}</span>
                      : <span className="text-xs opacity-40">Non utilisé</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!inv.usedAt && (
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
