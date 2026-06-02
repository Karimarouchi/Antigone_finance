import React, { useTransition } from 'react'
import { logout } from '@/lib/auth-actions'

interface Props {
  className?: string
  style?: React.CSSProperties
}

export function LogoutButton({ className, style }: Props) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await logout()
      // Hard navigation so root layout re-runs and clears the previous
      // user's feature grants from the server-side initial data.
      window.location.href = result.redirectTo
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={className}
      style={style}
      aria-label="Se déconnecter"
    >
      {isPending ? '...' : 'Déconnexion'}
    </button>
  )
}
