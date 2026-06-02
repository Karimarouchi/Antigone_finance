import { useTransition }          from 'react'
import { useAuth }                from '@/context/AuthContext'
import { logout }                 from '@/lib/auth-actions'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
}                                 from '@/components/ui/dropdown-menu'
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
}                                 from '@/components/ui/avatar'
import {
  ShieldCheck,
  ShieldAlert,
  LogOut,
  Home,
  Settings,
}                                 from 'lucide-react'
import { ROUTES }                 from '@/config/routes'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null, email: string | null): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin:       'Admin',
  user:        'Utilisateur',
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  admin:       'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  user:        'bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400',
}

// ── Nav row ───────────────────────────────────────────────────────────────────
// `group` enables icon-box and text reactions to the row hover state.

interface NavRowProps {
  href:        string
  icon:        React.ReactNode
  label:       string
  description: string
  iconHover?:  string   // extra classes applied to icon box on hover (via group)
}

function NavRow({ href, icon, label, description, iconHover = 'group-hover:bg-gray-200 dark:group-hover:bg-[#48484a]' }: NavRowProps) {
  return (
    <a
      href={href}
      className="group flex items-start gap-3 rounded-xl p-3 leading-none no-underline outline-none
                 transition-all duration-200 ease-out
                 hover:bg-[var(--surface)] hover:translate-x-0.5
                 cursor-pointer w-full"
    >
      <span className={`
        mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
        bg-[var(--surface)] text-[var(--muted)]
        transition-all duration-200
        group-hover:scale-110 group-hover:shadow-sm
        ${iconHover}
      `}>
        {icon}
      </span>
      <div>
        <div className="text-sm font-semibold text-[var(--text)] transition-colors duration-200">
          {label}
        </div>
        <p className="mt-0.5 text-xs leading-snug text-[var(--muted)] transition-colors duration-200">
          {description}
        </p>
      </div>
    </a>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UserAvatarMenu() {
  const { user, profile, can, loading } = useAuth()
  const [isPending, startTransition]    = useTransition()

  if (loading || !user) return null

  const initials    = getInitials(profile?.full_name ?? null, user.email ?? null)
  const displayName = profile?.full_name || user.email || 'Utilisateur'
  const roleLabel   = profile?.role ? ROLE_LABEL[profile.role] : null
  const roleColor   = profile?.role ? ROLE_COLORS[profile.role] : ROLE_COLORS.user

  const showAdmin      = can('admin')
  const showSuperAdmin = profile?.role === 'super_admin'

  function handleLogout() {
    startTransition(async () => {
      const result = await logout()
      window.location.href = result.redirectTo
    })
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          className="
            relative flex items-center rounded-full outline-none
            ring-2 ring-transparent
            transition-all duration-200 ease-out
            hover:ring-[var(--border)] hover:scale-105
            active:scale-95
            focus-visible:ring-[var(--border)]
            disabled:opacity-60
          "
          aria-label="Menu utilisateur"
          disabled={isPending}
        >
          <Avatar className="h-11 w-11 cursor-pointer shadow-sm transition-shadow duration-200 hover:shadow-md">
            <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback className="bg-gray-900 text-white text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="
          w-[280px] p-2 rounded-2xl
          border border-[var(--border)]
          bg-[var(--white)] text-[var(--text)]
          shadow-xl shadow-black/10
          data-[state=open]:animate-in   data-[state=open]:fade-in-0   data-[state=open]:zoom-in-95   data-[state=open]:slide-in-from-top-2
          data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-top-2
          data-[state=open]:duration-200  data-[state=closed]:duration-150
          origin-top-right
        "
      >
        {/* ── User info header ──────────────────────────────────────── */}
        <div className="flex items-center gap-3 rounded-xl px-3 py-3 mb-1">
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11 ring-2 ring-[var(--border)]">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={displayName} />
              <AvatarFallback className="bg-gray-900 text-white text-sm font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {/* Online indicator */}
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-[var(--white)]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--text)] truncate leading-tight">{displayName}</p>
            {profile?.full_name && (
              <p className="text-xs text-[var(--muted)] truncate mt-0.5">{user.email}</p>
            )}
            {roleLabel && (
              <span className={`mt-1.5 inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full ${roleColor}`}>
                {roleLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mx-3 border-t border-[var(--border)] mb-1" />

        {/* ── Navigation items ──────────────────────────────────────── */}
        <DropdownMenuItem asChild className="p-0 focus:bg-transparent [&>*]:w-full">
          <NavRow
            href={ROUTES.app.dashboard}
            icon={<Home className="w-4 h-4" />}
            label="Accueil"
            description="Tableau de bord principal"
          />
        </DropdownMenuItem>

        <DropdownMenuItem asChild className="p-0 focus:bg-transparent [&>*]:w-full">
          <NavRow
            href={ROUTES.app.profile}
            icon={<Settings className="w-4 h-4" />}
            label="Mon profil"
            description="Informations personnelles et sécurité"
          />
        </DropdownMenuItem>

        {showAdmin && (
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent [&>*]:w-full">
            <NavRow
              href={ROUTES.app.admin}
              icon={<ShieldCheck className="w-4 h-4" />}
              label="Administration"
              description="Gérer les utilisateurs et accès"
              iconHover="group-hover:bg-blue-100 group-hover:text-blue-600 dark:group-hover:bg-blue-900/40 dark:group-hover:text-blue-300"
            />
          </DropdownMenuItem>
        )}

        {showSuperAdmin && (
          <DropdownMenuItem asChild className="p-0 focus:bg-transparent [&>*]:w-full">
            <NavRow
              href={ROUTES.app.superAdmin}
              icon={<ShieldAlert className="w-4 h-4" />}
              label="Super Administration"
              description="Contrôle total du système"
              iconHover="group-hover:bg-violet-100 group-hover:text-violet-600 dark:group-hover:bg-violet-900/40 dark:group-hover:text-violet-300"
            />
          </DropdownMenuItem>
        )}

        <div className="mx-3 border-t border-[var(--border)] mt-1 mb-1" />

        {/* ── Logout ───────────────────────────────────────────────── */}
        <DropdownMenuItem onSelect={handleLogout} disabled={isPending} className="p-0 focus:bg-transparent [&>*]:w-full">
          <button
            disabled={isPending}
            className="
              group flex items-start gap-3 rounded-xl p-3 w-full text-left
              transition-all duration-200 ease-out
              hover:bg-red-50 dark:hover:bg-red-950/30
              hover:translate-x-0.5
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <span className="
              mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg
              bg-red-50 text-red-500
              dark:bg-red-950/40 dark:text-red-400
              transition-all duration-200
              group-hover:scale-110 group-hover:bg-red-100 group-hover:shadow-sm
              dark:group-hover:bg-red-900/60
            ">
              <LogOut className="w-4 h-4" />
            </span>
            <div>
              <div className="text-sm font-semibold text-red-600 dark:text-red-400">
                {isPending ? 'Déconnexion…' : 'Se déconnecter'}
              </div>
              <p className="mt-0.5 text-xs leading-snug text-red-400 dark:text-red-500">
                Fermer la session en cours
              </p>
            </div>
          </button>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
