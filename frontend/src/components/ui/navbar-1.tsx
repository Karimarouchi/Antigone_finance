import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "motion/react"
import { Menu, X, ChevronDown, LayoutDashboard, Wallet, PiggyBank, ShoppingCart, FileText, Landmark, TrendingUp, PlusCircle } from "lucide-react"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/hooks/useTheme"
import { LogoutButton } from "@/components/ui/LogoutButton"
import { UserAvatarMenu } from "@/components/ui/UserAvatarMenu"
import { ROUTES } from "@/config/routes"

const LIGHT = {
  pillBg:       "#ffffff",
  pillShadow:   "0 4px 16px rgba(0,0,0,0.08)",
  text:         "#111827",
  textHover:    "#4b5563",
  muted:        "#6b7280",
  dropHover:    "#f9fafb",
  iconBg:       "#f3f4f6",
  iconColor:    "#4b5563",
  mobileBg:     "#ffffff",
  sep:          "#f3f4f6",
  vpBg:         "#ffffff",
  vpShadow:     "0 8px 24px rgba(0,0,0,0.12)",
}
const DARK = {
  pillBg:       "#1c1c1e",
  pillShadow:   "0 4px 24px rgba(0,0,0,0.5)",
  text:         "#f2f2f7",
  textHover:    "#98989d",
  muted:        "#636366",
  dropHover:    "#2c2c2e",
  iconBg:       "#2c2c2e",
  iconColor:    "#98989d",
  mobileBg:     "#0f0f11",
  sep:          "#2c2c2e",
  vpBg:         "#1c1c1e",
  vpShadow:     "0 8px 40px rgba(0,0,0,0.6)",
}

// ── Nav item definitions — featureId matches config/features.ts ids ───────────

const ENCAISSEMENTS_SUB = [
  {
    featureId:   "encaissements-overview",
    label:       "Vue d'ensemble",
    href:        ROUTES.app.encaissements.overview,
    description: "Synthèse globale des encaissements",
    icon:        <LayoutDashboard className="w-4 h-4" />,
  },
  {
    featureId:   "encaissements-factures",
    label:       "Factures",
    href:        ROUTES.app.encaissements.factures,
    description: "Suivi des paiements et factures émises",
    icon:        <TrendingUp className="w-4 h-4" />,
  },
  {
    featureId:   "encaissements-autres-revenus",
    label:       "Autres revenus",
    href:        ROUTES.app.encaissements.autresRevenus,
    description: "Revenus manuels hors facturation",
    icon:        <PlusCircle className="w-4 h-4" />,
  },
]

const DECAISSEMENTS_SUB = [
  {
    featureId:   "decaissements-overview",
    label:       "Vue d'ensemble",
    href:        ROUTES.app.decaissements.overview,
    description: "Tableau de bord des dépenses",
    icon:        <LayoutDashboard className="w-4 h-4" />,
  },
  {
    featureId:   "decaissements-salaires",
    label:       "Salaires",
    href:        ROUTES.app.decaissements.salaires,
    description: "Paie et fiches de salaire",
    icon:        <Wallet className="w-4 h-4" />,
  },
  {
    featureId:   "decaissements-charges-fixes",
    label:       "Charges fixes",
    href:        ROUTES.app.decaissements.chargesFixes,
    description: "Loyer, crédit et services récurrents",
    icon:        <PiggyBank className="w-4 h-4" />,
  },
  {
    featureId:   "decaissements-charges-variables",
    label:       "Charges variables",
    href:        ROUTES.app.decaissements.chargesVariables,
    description: "Dépenses ponctuelles par catégorie",
    icon:        <ShoppingCart className="w-4 h-4" />,
  },
  {
    featureId:   "decaissements-etat",
    label:       "État (Taxes)",
    href:        ROUTES.app.decaissements.etat,
    description: "CNSS, IRPP, TVA et taxes manuelles",
    icon:        <FileText className="w-4 h-4" />,
  },
  {
    featureId:   "decaissements-dettes",
    label:       "Dettes",
    href:        ROUTES.app.decaissements.dettes,
    description: "Suivi et remboursement des créances",
    icon:        <Landmark className="w-4 h-4" />,
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

const Navbar1 = () => {
  const [scrolled,        setScrolled]        = useState(false)
  const [hidden,          setHidden]          = useState(false)
  const [isOpen,          setIsOpen]          = useState(false)
  const [mobileEncOpen,   setMobileEncOpen]   = useState(false)
  const [mobileDecOpen,   setMobileDecOpen]   = useState(false)

  const toggleMenu = () => setIsOpen(!isOpen)

  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const c = mounted && theme === 'dark' ? DARK : LIGHT

  const { can, loading, user, profile } = useAuth()

  const showClients    = can("clients")
  const showInvoiceCta = can("invoice-creator")

  const visibleEncRest = ENCAISSEMENTS_SUB.filter((s) => s.featureId !== 'encaissements-overview' && can(s.featureId))
  const overviewItem   = ENCAISSEMENTS_SUB.find((s) => s.featureId === 'encaissements-overview')!
  const visibleEnc     = visibleEncRest.length > 0 ? [overviewItem, ...visibleEncRest] : []
  const visibleDec = DECAISSEMENTS_SUB.filter((s) => can(s.featureId))

  const showEncGroup = visibleEnc.length > 0
  const showDecGroup = visibleDec.length > 0

  const navGroupCount = 1
    + (showClients   ? 1 : 0)
    + (showEncGroup  ? 1 : 0)
    + (showDecGroup  ? 1 : 0)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    const onHide = () => setHidden(true)
    const onShow = () => setHidden(false)
    window.addEventListener("navbar-hide", onHide)
    window.addEventListener("navbar-show", onShow)
    return () => {
      window.removeEventListener("navbar-hide", onHide)
      window.removeEventListener("navbar-show", onShow)
    }
  }, [])

  if (hidden) return null

  return (
    <>
      {/* Fixed avatar menu */}
      <div className="fixed top-6 right-6 z-[2001]">
        <UserAvatarMenu />
      </div>

      {/* Collapsed circle */}
      <AnimatePresence>
        {scrolled && (
          <motion.div
            className="fixed top-4 left-4 z-[2001]"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
          >
            <motion.img
              src="/icon.png"
              alt="Antigone"
              whileHover={{ scale: 1.1 }}
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              style={{ cursor: "pointer", width: 40, height: 40, objectFit: "contain" }}
              onMouseEnter={(e) => (e.currentTarget.src = "/iconmv.png")}
              onMouseLeave={(e) => (e.currentTarget.src = "/icon.png")}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full navbar */}
      <div style={{
        minHeight:    scrolled ? 0 : undefined,
        height:       scrolled ? 0 : "auto",
        overflow:     scrolled ? "hidden" : "visible",
        marginBottom: scrolled ? 0 : 25,
        transition:   "height 0.3s ease, margin-bottom 0.3s ease, min-height 0.3s ease",
      } as React.CSSProperties}>
        <AnimatePresence>
          {!scrolled && (
            <motion.div
              className="flex justify-center w-full py-2 px-4"
              initial={{ y: -80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -80, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
            >
              <div
                className="flex items-center px-6 py-3 rounded-full relative z-10 gap-6"
                style={{
                  width:           "auto",
                  minWidth:        "fit-content",
                  maxWidth:        "calc(100vw - 2rem)",
                  transition:      "width 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
                  background:      c.pillBg,
                  boxShadow:       c.pillShadow,
                }}
              >
                {/* Logo */}
                <div className="flex items-center flex-shrink-0">
                  <motion.div
                    className="w-8 h-8 cursor-pointer"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    whileHover={{ scale: 1.15 }}
                    transition={{ type: "spring", damping: 15, stiffness: 300 }}
                    onClick={() => (window.location.href = ROUTES.app.dashboard)}
                  >
                    <img
                      src="/icon.png"
                      alt="Antigone"
                      className="w-8 h-8 object-contain"
                      onMouseEnter={(e) => (e.currentTarget.src = "/iconmv.png")}
                      onMouseLeave={(e) => (e.currentTarget.src = "/icon.png")}
                    />
                  </motion.div>
                </div>

                {/* Desktop Navigation */}
                <nav className="hidden md:flex items-center gap-6 flex-1">

                  {/* Accueil */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <a href={ROUTES.app.dashboard} className="text-sm font-medium transition-colors" style={{ color: c.text }}>
                      Accueil
                    </a>
                  </motion.div>

                  {/* Clients */}
                  <AnimatePresence>
                    {showClients && (
                      <motion.div
                        key="nav-clients"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <a href={ROUTES.app.clients} className="text-sm font-medium transition-colors" style={{ color: c.text }}>
                          Clients
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Aperçu */}
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.05 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    <a href={ROUTES.app.apercu} className="text-sm font-medium transition-colors" style={{ color: c.text }}>
                      Aperçu
                    </a>
                  </motion.div>

                  {/* Encaissements dropdown */}
                  <AnimatePresence>
                    {showEncGroup && (
                      <motion.div
                        key="nav-encaissements"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <NavigationMenu viewportStyle={{ background: c.vpBg, color: c.text, boxShadow: c.vpShadow }}>
                          <NavigationMenuList>
                            <NavigationMenuItem>
                              <NavigationMenuTrigger className="!bg-transparent !p-0 !h-auto text-sm font-medium !shadow-none !border-none !ring-0 data-[state=open]:!bg-transparent" style={{ color: c.text }}>
                                Encaissements
                              </NavigationMenuTrigger>
                              <NavigationMenuContent>
                                <ul className="w-[280px] p-2">
                                  {visibleEnc.map((sub) => (
                                    <li key={sub.featureId}>
                                      <NavigationMenuLink asChild>
                                        <a href={sub.href} className="flex items-start gap-3 rounded-xl p-3 leading-none no-underline outline-none transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = c.dropHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: c.iconBg, color: c.iconColor }}>
                                            {sub.icon}
                                          </span>
                                          <div>
                                            <div className="text-sm font-semibold" style={{ color: c.text }}>{sub.label}</div>
                                            <p className="mt-0.5 text-xs leading-snug" style={{ color: c.muted }}>{sub.description}</p>
                                          </div>
                                        </a>
                                      </NavigationMenuLink>
                                    </li>
                                  ))}
                                </ul>
                              </NavigationMenuContent>
                            </NavigationMenuItem>
                          </NavigationMenuList>
                        </NavigationMenu>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Décaissements dropdown */}
                  <AnimatePresence>
                    {showDecGroup && (
                      <motion.div
                        key="nav-decaissements"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <NavigationMenu viewportStyle={{ background: c.vpBg, color: c.text, boxShadow: c.vpShadow }}>
                          <NavigationMenuList>
                            <NavigationMenuItem>
                              <NavigationMenuTrigger className="!bg-transparent !p-0 !h-auto text-sm font-medium !shadow-none !border-none !ring-0 data-[state=open]:!bg-transparent" style={{ color: c.text }}>
                                Décaissements
                              </NavigationMenuTrigger>
                              <NavigationMenuContent>
                                <ul className="w-[280px] p-2">
                                  {visibleDec.map((sub) => (
                                    <li key={sub.featureId}>
                                      <NavigationMenuLink asChild>
                                        <a href={sub.href} className="flex items-start gap-3 rounded-xl p-3 leading-none no-underline outline-none transition-colors" onMouseEnter={(e) => (e.currentTarget.style.background = c.dropHover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: c.iconBg, color: c.iconColor }}>
                                            {sub.icon}
                                          </span>
                                          <div>
                                            <div className="text-sm font-semibold" style={{ color: c.text }}>{sub.label}</div>
                                            <p className="mt-0.5 text-xs leading-snug" style={{ color: c.muted }}>{sub.description}</p>
                                          </div>
                                        </a>
                                      </NavigationMenuLink>
                                    </li>
                                  ))}
                                </ul>
                              </NavigationMenuContent>
                            </NavigationMenuItem>
                          </NavigationMenuList>
                        </NavigationMenu>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </nav>

                <div className="flex items-center gap-3 ml-auto flex-shrink-0">
                  <AnimatePresence>
                    {showInvoiceCta && (
                      <motion.div
                        key="nav-invoice-cta"
                        className="hidden md:block"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.2 }}
                        whileHover={{ scale: 1.05 }}
                      >
                        <a
                          href={ROUTES.app.invoice}
                          className="inline-flex items-center justify-center px-5 py-2 text-sm text-white bg-black rounded-full hover:bg-gray-800 transition-colors"
                        >
                          Créateur de Factures
                        </a>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Hamburger */}
                  <motion.button
                    className="md:hidden flex items-center"
                    onClick={toggleMenu}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Menu className="h-6 w-6" style={{ color: c.text }} />
                  </motion.button>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 z-50 pt-24 px-6 md:hidden"
            style={{ background: c.mobileBg }}
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <motion.button
              className="absolute top-6 right-6 p-2"
              onClick={toggleMenu}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <X className="h-6 w-6" style={{ color: c.text }} />
            </motion.button>

            <div className="flex flex-col space-y-6">

              {/* Mobile user info */}
              {user && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 }}
                  className="flex items-center gap-3 pb-4 border-b"
                  style={{ borderColor: c.sep }}
                >
                  <div className="h-9 w-9 rounded-full bg-gray-900 text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {(profile?.full_name ?? user.email ?? "?")[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: c.text }}>
                      {profile?.full_name || user.email}
                    </p>
                    {profile?.full_name && (
                      <p className="text-xs truncate" style={{ color: c.muted }}>{user.email}</p>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Accueil */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <a href={ROUTES.app.dashboard} className="navbar-link text-base font-medium" onClick={toggleMenu}>
                  Accueil
                </a>
              </motion.div>

              {/* Clients */}
              {showClients && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <a href={ROUTES.app.clients} className="navbar-link text-base font-medium" onClick={toggleMenu}>
                    Clients
                  </a>
                </motion.div>
              )}

              {/* Encaissements accordion */}
              {showEncGroup && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <button
                    className="flex items-center gap-1 text-base font-medium" style={{ color: c.text }}
                    onClick={() => setMobileEncOpen((o) => !o)}
                  >
                    Encaissements
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-200"
                      style={{ color: c.muted, transform: mobileEncOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileEncOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 mt-3 ml-4">
                          {visibleEnc.map((sub) => (
                            <a
                              key={sub.featureId}
                              href={sub.href}
                              className="flex items-center gap-3 text-sm font-medium" style={{ color: c.text }}
                              onClick={toggleMenu}
                            >
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.iconBg, color: c.iconColor }}>
                                {sub.icon}
                              </span>
                              {sub.label}
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* Décaissements accordion */}
              {showDecGroup && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <button
                    className="flex items-center gap-1 text-base font-medium" style={{ color: c.text }}
                    onClick={() => setMobileDecOpen((o) => !o)}
                  >
                    Décaissements
                    <ChevronDown
                      className="h-4 w-4 transition-transform duration-200"
                      style={{ color: c.muted, transform: mobileDecOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </button>
                  <AnimatePresence>
                    {mobileDecOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-3 mt-3 ml-4">
                          {visibleDec.map((sub) => (
                            <a
                              key={sub.featureId}
                              href={sub.href}
                              className="flex items-center gap-3 text-sm font-medium" style={{ color: c.text }}
                              onClick={toggleMenu}
                            >
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: c.iconBg, color: c.iconColor }}>
                                {sub.icon}
                              </span>
                              {sub.label}
                            </a>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* CTA Button */}
              {showInvoiceCta && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="pt-6"
                >
                  <a
                    href={ROUTES.app.invoice}
                    className="inline-flex items-center justify-center w-full px-5 py-3 text-base text-white bg-black rounded-full hover:bg-gray-800 transition-colors"
                    onClick={toggleMenu}
                  >
                    Créateur de Factures
                  </a>
                </motion.div>
              )}

              {/* Mobile Logout */}
              {user && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="pt-2 border-t"
                  style={{ borderColor: c.sep }}
                >
                  <LogoutButton className="w-full text-left text-base font-medium py-2 transition-colors" style={{ color: c.muted }} />
                </motion.div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export { Navbar1 }
