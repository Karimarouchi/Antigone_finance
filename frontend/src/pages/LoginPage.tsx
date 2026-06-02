import { useState, useEffect, useRef, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ROUTES } from '@/config/routes';

// ── Animated character internals ─────────────────────────────────────────────

interface EyeBallProps {
  size?: number;
  pupilSize?: number;
  maxDistance?: number;
  eyeColor?: string;
  pupilColor?: string;
  isBlinking?: boolean;
  forceLookX?: number;
  forceLookY?: number;
}

function EyeBall({
  size = 48, pupilSize = 16, maxDistance = 10,
  eyeColor = 'white', pupilColor = 'black',
  isBlinking = false, forceLookX, forceLookY,
}: EyeBallProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const eyeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!eyeRef.current) return { x: 0, y: 0 };
    const r = eyeRef.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div
      ref={eyeRef}
      className="rounded-full flex items-center justify-center"
      style={{
        width: `${size}px`,
        height: isBlinking ? '2px' : `${size}px`,
        backgroundColor: eyeColor,
        overflow: 'hidden',
        transition: 'height 0.1s ease',
      }}
    >
      {!isBlinking && (
        <div className="rounded-full" style={{
          width: `${pupilSize}px`, height: `${pupilSize}px`,
          backgroundColor: pupilColor,
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          transition: 'transform 0.1s ease-out',
        }} />
      )}
    </div>
  );
}

function Pupil({ size = 12, maxDistance = 5, pupilColor = 'black', forceLookX, forceLookY }:
  { size?: number; maxDistance?: number; pupilColor?: string; forceLookX?: number; forceLookY?: number }) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const pos = (() => {
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    if (!ref.current) return { x: 0, y: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();

  return (
    <div ref={ref} className="rounded-full" style={{
      width: `${size}px`, height: `${size}px`,
      backgroundColor: pupilColor,
      transform: `translate(${pos.x}px, ${pos.y}px)`,
      transition: 'transform 0.1s ease-out',
    }} />
  );
}

// ── Characters panel ──────────────────────────────────────────────────────────

function CharactersPanel({ isTyping, showPassword, password }: {
  isTyping: boolean; showPassword: boolean; password: string;
}) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [purpleBlinking, setPurpleBlinking] = useState(false);
  const [blackBlinking, setBlackBlinking] = useState(false);
  const [lookingAtEachOther, setLookingAtEachOther] = useState(false);
  const [purplePeeking, setPurplePeeking] = useState(false);
  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useEffect(() => {
    const blink = (set: (v: boolean) => void) => {
      const t = setTimeout(() => {
        set(true);
        setTimeout(() => { set(false); blink(set); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = blink(setPurpleBlinking);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const blink = (set: (v: boolean) => void) => {
      const t = setTimeout(() => {
        set(true);
        setTimeout(() => { set(false); blink(set); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t = blink(setBlackBlinking);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!isTyping) { setLookingAtEachOther(false); return; }
    setLookingAtEachOther(true);
    const t = setTimeout(() => setLookingAtEachOther(false), 800);
    return () => clearTimeout(t);
  }, [isTyping]);

  useEffect(() => {
    if (!password || !showPassword) { setPurplePeeking(false); return; }
    const t = setTimeout(() => {
      setPurplePeeking(true);
      setTimeout(() => setPurplePeeking(false), 800);
    }, Math.random() * 3000 + 2000);
    return () => clearTimeout(t);
  }, [password, showPassword, purplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const dx = mouseX - (r.left + r.width / 2);
    const dy = mouseY - (r.top + r.height / 3);
    return {
      faceX: Math.max(-15, Math.min(15, dx / 20)),
      faceY: Math.max(-10, Math.min(10, dy / 30)),
      bodySkew: Math.max(-6, Math.min(6, -dx / 120)),
    };
  };

  const p = calcPos(purpleRef);
  const b = calcPos(blackRef);
  const y = calcPos(yellowRef);
  const o = calcPos(orangeRef);

  const passwordActive = password.length > 0;
  const coveringEyes = passwordActive && !showPassword;

  return (
    <div
      className="relative hidden lg:flex flex-col justify-center overflow-hidden"
      style={{ borderRight: '1px solid var(--border, #e0e0e5)' }}
    >
      <div className="relative z-20 flex items-end justify-center w-full" style={{ height: 'min(380px, 55%)' }}>
        <div className="relative w-full max-w-[520px]" style={{ height: '100%' }}>

          {/* Purple — back */}
          <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '70px', width: '175px',
              height: coveringEyes ? '420px' : '380px',
              backgroundColor: '#7C3AED',
              borderRadius: '10px 10px 0 0', zIndex: 1,
              transform: passwordActive && showPassword
                ? 'skewX(0deg)'
                : coveringEyes
                  ? `skewX(${(p.bodySkew || 0) - 12}deg) translateX(38px)`
                  : `skewX(${p.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div className="absolute flex gap-7 transition-all duration-700 ease-in-out"
              style={{
                left: passwordActive && showPassword ? '18px' : lookingAtEachOther ? '52px' : `${43 + p.faceX}px`,
                top: passwordActive && showPassword ? '32px' : lookingAtEachOther ? '62px' : `${38 + p.faceY}px`,
              }}
            >
              {[0, 1].map(i => (
                <EyeBall key={i} size={18} pupilSize={7} maxDistance={5}
                  eyeColor="#f0f0f4" pupilColor="#1a1a2e" isBlinking={purpleBlinking}
                  forceLookX={passwordActive && showPassword ? (purplePeeking ? 4 : -4) : lookingAtEachOther ? 3 : undefined}
                  forceLookY={passwordActive && showPassword ? (purplePeeking ? 5 : -4) : lookingAtEachOther ? 4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Black — middle */}
          <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '235px', width: '115px', height: '295px',
              backgroundColor: '#1e1e2e',
              borderRadius: '8px 8px 0 0', zIndex: 2,
              border: '2px solid #333355',
              transform: passwordActive && showPassword
                ? 'skewX(0deg)'
                : lookingAtEachOther
                  ? `skewX(${(b.bodySkew || 0) * 1.5 + 10}deg) translateX(18px)`
                  : coveringEyes
                    ? `skewX(${(b.bodySkew || 0) * 1.5}deg)`
                    : `skewX(${b.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div className="absolute flex gap-5 transition-all duration-700 ease-in-out"
              style={{
                left: passwordActive && showPassword ? '8px' : lookingAtEachOther ? '30px' : `${24 + b.faceX}px`,
                top: passwordActive && showPassword ? '26px' : lookingAtEachOther ? '10px' : `${30 + b.faceY}px`,
              }}
            >
              {[0, 1].map(i => (
                <EyeBall key={i} size={16} pupilSize={6} maxDistance={4}
                  eyeColor="#f0f0f4" pupilColor="#1e1e2e" isBlinking={blackBlinking}
                  forceLookX={passwordActive && showPassword ? -4 : lookingAtEachOther ? 0 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : lookingAtEachOther ? -4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Orange — front left */}
          <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '0px', width: '230px', height: '190px',
              backgroundColor: '#e8621a',
              borderRadius: '115px 115px 0 0', zIndex: 3,
              transform: passwordActive && showPassword ? 'skewX(0deg)' : `skewX(${o.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div className="absolute flex gap-7 transition-all duration-200 ease-out"
              style={{
                left: passwordActive && showPassword ? '46px' : `${78 + (o.faceX || 0)}px`,
                top: passwordActive && showPassword ? '80px' : `${86 + (o.faceY || 0)}px`,
              }}
            >
              {[0, 1].map(i => (
                <Pupil key={i} size={12} maxDistance={5} pupilColor="#1a1a2e"
                  forceLookX={passwordActive && showPassword ? -5 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : undefined}
                />
              ))}
            </div>
          </div>

          {/* Yellow — front right */}
          <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
            style={{
              left: '298px', width: '135px', height: '220px',
              backgroundColor: '#F59E0B',
              borderRadius: '67px 67px 0 0', zIndex: 4,
              transform: passwordActive && showPassword ? 'skewX(0deg)' : `skewX(${y.bodySkew || 0}deg)`,
              transformOrigin: 'bottom center',
            }}
          >
            <div className="absolute flex gap-5 transition-all duration-200 ease-out"
              style={{
                left: passwordActive && showPassword ? '18px' : `${49 + (y.faceX || 0)}px`,
                top: passwordActive && showPassword ? '32px' : `${38 + (y.faceY || 0)}px`,
              }}
            >
              {[0, 1].map(i => (
                <Pupil key={i} size={12} maxDistance={5} pupilColor="#1a1a2e"
                  forceLookX={passwordActive && showPassword ? -5 : undefined}
                  forceLookY={passwordActive && showPassword ? -4 : undefined}
                />
              ))}
            </div>
            <div className="absolute rounded-full transition-all duration-200 ease-out"
              style={{
                width: '72px', height: '4px', backgroundColor: '#1a1a2e',
                left: passwordActive && showPassword ? '8px' : `${38 + (y.faceX || 0)}px`,
                top: passwordActive && showPassword ? '85px' : `${85 + (y.faceY || 0)}px`,
              }}
            />
          </div>

        </div>
      </div>
    </div>
  );
}

// ── Login page ────────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '13px', fontWeight: 500, color: 'var(--text, #1d1d1f)',
};

const inputStyle: React.CSSProperties = {
  height: '46px', padding: '0 20px',
  borderRadius: '9999px',
  border: '1px solid var(--border, #e0e0e5)',
  background: 'var(--surface, #f9f9fb)',
  color: 'var(--text, #1d1d1f)',
  fontSize: '14px', fontFamily: 'inherit', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};

const submitStyle = (disabled: boolean): React.CSSProperties => ({
  height: '46px', borderRadius: '9999px', border: 'none',
  background: '#e8621a', color: '#ffffff',
  fontSize: '15px', fontWeight: 600, fontFamily: 'inherit',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
  width: '100%',
});

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true); setError(null);
    try {
      await login(email, password);
      nav(ROUTES.app.dashboard, { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Identifiants incorrects.');
    } finally { setPending(false); }
  }

  return (
    <div className="h-full grid lg:grid-cols-2">
      <CharactersPanel isTyping={isTyping} showPassword={showPassword} password={password} />

      {/* Form side */}
      <div className="flex items-center justify-center p-8 overflow-y-auto">
        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <motion.div
            className="lg:hidden flex items-center gap-3 justify-center mb-10"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#e8621a' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="text-lg font-bold" style={{ color: 'var(--text, #1d1d1f)' }}>Antigone Pay</span>
          </motion.div>

          <motion.div className="mb-8"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
          >
            <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text, #1d1d1f)', margin: '0 0 6px' }}>
              Bon retour !
            </h1>
            <p style={{ fontSize: '14px', color: 'var(--muted, #6e6e73)', margin: 0 }}>
              Connectez-vous à votre espace Antigone Pay
            </p>
          </motion.div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.15 }}
            >
              <label htmlFor="email" style={labelStyle}>Email</label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                placeholder="vous@exemple.com"
                value={email} onChange={e => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                style={inputStyle}
              />
            </motion.div>

            <motion.div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.25 }}
            >
              <label htmlFor="password" style={labelStyle}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password" required
                  placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  style={{ ...inputStyle, paddingRight: '48px' }}
                />
                <button type="button" onClick={() => setShowPassword(v => !v)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--muted, #6e6e73)', display: 'flex', alignItems: 'center',
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </motion.div>

            {error && (
              <motion.p
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                style={{
                  fontSize: '13px', color: '#ff3b30',
                  background: 'rgba(255,59,48,0.08)',
                  borderRadius: '8px', padding: '10px 12px', margin: 0,
                }}
              >
                {error}
              </motion.p>
            )}

            <motion.button type="submit" disabled={pending}
              style={submitStyle(pending)}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut', delay: 0.35 }}
              whileHover={pending ? {} : { opacity: 0.88 }}
              whileTap={pending ? {} : { scale: 0.98 }}
            >
              {pending ? 'Connexion…' : 'Se connecter'}
            </motion.button>
          </form>

          <motion.p
            style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--muted, #6e6e73)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.45 }}
          >
            Pas encore de compte ?{' '}
            <Link to={ROUTES.signup} style={{ color: '#e8621a', textDecoration: 'none', fontWeight: 500 }}>
              Créer un compte
            </Link>
          </motion.p>
        </div>
      </div>
    </div>
  );
}
