import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { APP_REGISTRY } from '@/config/features'
import { FeatureAssignmentPanel } from '@/components/ui/FeatureAssignmentPanel'
import type { FAPUser, FAPFeatureGroup, FAPGrantSet } from '@/components/ui/FeatureAssignmentPanel'

// ── Types ──────────────────────────────────────────────────────────────────────

type ProfileRole = 'user' | 'admin' | 'super_admin'

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

// ── Feature groups ─────────────────────────────────────────────────────────────

const EXCLUDED = ['home', 'super-admin']

const FEATURE_GROUPS: FAPFeatureGroup[] = [
  {
    id: 'general',
    label: 'Accès généraux',
    items: APP_REGISTRY.standalone
      .filter(s => !['home', 'admin', 'super-admin'].includes(s.id))
      .map(s => ({ id: s.id, label: s.label, description: s.description })),
  },
  ...APP_REGISTRY.groups.map(g => ({
    id: g.id,
    label: g.label,
    items: g.features.map(f => ({ id: f.id, label: f.label, description: f.description })),
  })),
]


// ── Helpers ────────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  user:        'Utilisateur',
}
const ROLE_CLASS: Record<string, string> = {
  super_admin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  admin:       'bg-blue-500/20 text-blue-400 border-blue-500/30',
  user:        'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
}

function roleBadge(role: string) {
  const cls = ROLE_CLASS[role] ?? ROLE_CLASS.user
  const label = ROLE_LABELS[role] ?? role
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${cls}`}>{label}</span>
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' })
}

type Tab = 'users' | 'assign'

// ── Main component ─────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [users,   setUsers]   = useState<UserView[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)
  const [tab,     setTab]     = useState<Tab>('users')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await api.get<UserView[]>('/api/admin/users')
      setUsers(data)
    } catch {
      setError('Impossible de charger les données.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const onGrant = async (userId: string, featureId: string) => {
    try {
      await api.post(`/api/me/features/admin/${userId}/${featureId}`)
      setUsers(prev => prev.map(u => u.id === userId
        ? { ...u, features: u.features.includes(featureId) ? u.features : [...u.features, featureId] }
        : u))
      return {}
    } catch (e: any) {
      return { error: e.response?.data?.message ?? 'Erreur' }
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
      return { error: e.response?.data?.message ?? 'Erreur' }
    }
  }

  const grants: FAPGrantSet = {}
  for (const u of users) {
    for (const f of u.features) {
      grants[`${u.id}::${f}`] = true
    }
  }

  const fapUsers: FAPUser[] = users.map(u => ({
    id:         u.id,
    email:      u.email,
    full_name:  u.fullName,
    avatar_url: u.avatarUrl,
  }))

  if (loading) return <div className="flex items-center justify-center min-h-screen opacity-50">Chargement…</div>
  if (error)   return <div className="p-8 text-red-400">{error}</div>

  return (
    <div className="min-h-screen p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">Super Administration</h1>
        <p className="text-sm opacity-60 mt-1">Gérez les comptes, les rôles et les accès aux fonctionnalités.</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {([
          ['users',  'Utilisateurs'],
          ['assign', 'Attribution des accès'],
        ] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent opacity-60 hover:opacity-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'users'  && <UsersPanel users={users} setUsers={setUsers} onRefresh={load} />}
      {tab === 'assign' && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
          {users.length === 0
            ? <p className="text-sm opacity-50">Aucun utilisateur.</p>
            : <FeatureAssignmentPanel users={fapUsers} featureGroups={FEATURE_GROUPS} grants={grants} onGrant={onGrant} onRevoke={onRevoke} />
          }
        </div>
      )}
    </div>
  )
}

// ── Users panel ────────────────────────────────────────────────────────────────

function UsersPanel({
  users, setUsers, onRefresh,
}: {
  users: UserView[]
  setUsers: React.Dispatch<React.SetStateAction<UserView[]>>
  onRefresh: () => void
}) {
  const [showCreate,  setShowCreate]  = useState(false)
  const [createForm,  setCreateForm]  = useState({ email: '', password: '', fullName: '' })
  const [createErr,   setCreateErr]   = useState<string | null>(null)
  const [creating,    setCreating]    = useState(false)

  const [editId,   setEditId]   = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ email: '', password: '', fullName: '' })
  const [editErr,  setEditErr]  = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true); setCreateErr(null)
    try {
      const { data } = await api.post<UserView>('/api/admin/users', {
        email:    createForm.email,
        password: createForm.password,
        fullName: createForm.fullName || null,
      })
      setUsers(prev => [...prev, data].sort((a, b) => a.email.localeCompare(b.email)))
      setCreateForm({ email: '', password: '', fullName: '' })
      setShowCreate(false)
    } catch (err: any) {
      setCreateErr(err.response?.data?.message ?? 'Erreur lors de la création')
    } finally {
      setCreating(false)
    }
  }

  const startEdit = (u: UserView) => {
    setEditId(u.id)
    setEditForm({ email: u.email, password: '', fullName: u.fullName ?? '' })
    setEditErr(null)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editId) return
    setSaving(true); setEditErr(null)
    try {
      const { data } = await api.patch<UserView>(`/api/admin/users/${editId}`, {
        email:    editForm.email    || undefined,
        password: editForm.password || undefined,
        fullName: editForm.fullName,
      })
      setUsers(prev => prev.map(u => u.id === editId ? { ...u, ...data } : u))
      setEditId(null)
    } catch (err: any) {
      setEditErr(err.response?.data?.message ?? 'Erreur lors de la modification')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (userId: string, email: string) => {
    if (!confirm(`Supprimer définitivement l'utilisateur ${email} ?`)) return
    try {
      await api.delete(`/api/admin/users/${userId}`)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch {
      alert('Impossible de supprimer l\'utilisateur')
    }
  }

  const handleRoleChange = async (userId: string, role: ProfileRole) => {
    try {
      await api.patch(`/api/admin/users/${userId}/role`, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
    } catch {
      alert('Impossible de modifier le rôle')
    }
  }

  const toggleDisabled = async (userId: string, current: boolean) => {
    try {
      await api.patch(`/api/admin/users/${userId}/disabled`, { disabled: !current })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, disabled: !current } : u))
    } catch {
      alert('Impossible de modifier le statut')
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <span className="text-sm opacity-60">{users.length} utilisateur{users.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => { setShowCreate(v => !v); setCreateErr(null) }}
          className="text-sm px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors"
        >
          {showCreate ? 'Annuler' : '+ Nouvel utilisateur'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="px-5 py-4 border-b border-white/10 space-y-3">
          <h3 className="font-medium text-sm">Créer un utilisateur</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="block">
              <span className="text-xs opacity-60">Email *</span>
              <input
                type="email" required autoComplete="off"
                value={createForm.email}
                onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </label>
            <label className="block">
              <span className="text-xs opacity-60">Mot de passe *</span>
              <input
                type="password" required minLength={6} autoComplete="new-password"
                value={createForm.password}
                onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Min 6 caractères"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </label>
            <label className="block">
              <span className="text-xs opacity-60">Nom complet</span>
              <input
                type="text"
                value={createForm.fullName}
                onChange={e => setCreateForm(f => ({ ...f, fullName: e.target.value }))}
                placeholder="Optionnel"
                className="mt-1 w-full px-3 py-2 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30"
              />
            </label>
          </div>
          {createErr && <p className="text-red-400 text-sm">{createErr}</p>}
          <button type="submit" disabled={creating}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {creating ? 'Création…' : 'Créer'}
          </button>
        </form>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs opacity-50 uppercase tracking-wide">
            <tr className="border-b border-white/10">
              <th className="text-left px-5 py-3">Email / Nom</th>
              <th className="text-left px-4 py-3">Rôle</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Inscrit le</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              editId === user.id ? (
                <tr key={user.id} className="border-b border-white/10 bg-white/[0.03]">
                  <td colSpan={5} className="px-5 py-4">
                    <form onSubmit={handleEdit} className="flex flex-wrap gap-2 items-start">
                      <input
                        type="email" autoComplete="off"
                        value={editForm.email}
                        onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="Nouvel email"
                        className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30 w-52"
                      />
                      <input
                        type="password" autoComplete="new-password"
                        value={editForm.password}
                        onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="Nouveau mot de passe (vide = inchangé)"
                        className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30 w-64"
                      />
                      <input
                        type="text"
                        value={editForm.fullName}
                        onChange={e => setEditForm(f => ({ ...f, fullName: e.target.value }))}
                        placeholder="Nom complet"
                        className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-sm focus:outline-none focus:border-white/30 w-44"
                      />
                      {editErr && <p className="w-full text-red-400 text-xs">{editErr}</p>}
                      <div className="flex gap-2">
                        <button type="submit" disabled={saving}
                          className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm disabled:opacity-50 transition-colors"
                        >{saving ? 'Sauvegarde…' : 'Sauvegarder'}</button>
                        <button type="button" onClick={() => setEditId(null)}
                          className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm transition-colors"
                        >Annuler</button>
                      </div>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={user.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${user.disabled ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="font-medium">{user.email}</div>
                    {user.fullName && <div className="text-xs opacity-50">{user.fullName}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={e => handleRoleChange(user.id, e.target.value as ProfileRole)}
                      className="text-xs rounded px-2 py-1 bg-white/10 border border-white/10 focus:outline-none cursor-pointer"
                    >
                      <option value="user">Utilisateur</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </td>
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
                  <td className="px-4 py-3 opacity-60 text-xs">{formatDate(user.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3 justify-end">
                      <button onClick={() => startEdit(user)}
                        className="text-xs opacity-60 hover:opacity-100 transition-opacity"
                      >Modifier</button>
                      <button onClick={() => handleDelete(user.id, user.email)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                      >Supprimer</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
