import { Link } from 'react-router-dom';
import { motion } from 'motion/react'
import { ROUTES } from '@/config/routes'
import { AnimatedThemeToggler } from '@/components/ui/animated-theme-toggler'

export function PublicNavbar() {
  return (
    <header className="flex items-center justify-between px-8 py-5">
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex items-center gap-2.5"
      >
        <Link to={ROUTES.home}>
          <img src="/icon.png" alt="Antigone Pay" className="w-11 h-11 object-contain" />
        </Link>
      </motion.div>

      {/* Auth buttons */}
      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="flex items-center gap-3"
      >
        <AnimatedThemeToggler />
        <Link to={ROUTES.login}
          className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold rounded-full border transition-all active:scale-95"
          style={{
            color: 'var(--muted, #6e6e73)',
            background: 'transparent',
            borderColor: 'var(--border, #e0e0e5)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)'; e.currentTarget.style.borderColor = 'var(--text)' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted, #6e6e73)'; e.currentTarget.style.borderColor = 'var(--border, #e0e0e5)' }}
        >
          Se connecter
        </Link>
        <Link to={ROUTES.signup}
          className="inline-flex items-center justify-center px-5 py-2 text-sm font-semibold text-white rounded-full transition-all hover:opacity-88 active:scale-95"
          style={{ background: '#e8621a' }}
        >
          Créer un compte
        </Link>
      </motion.div>
    </header>
  )
}
