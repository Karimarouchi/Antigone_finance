import { useEffect, useState } from 'react';
import BorderGlow from './BorderGlow';
import { useShared } from '@/context/SharedContext';

export default function GlowCard({ children, className = '', borderRadius = 28 }: { children: React.ReactNode; className?: string; borderRadius?: number }) {
  const { state } = useShared();
  const isDark = state.theme === 'dark';
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Use a neutral background color during SSR that works in both light and dark
  const bgColor = isHydrated ? (isDark ? '#1c1c1e' : '#ffffff') : '#1c1c1e';

  return (
    <BorderGlow
      className={className}
      glowColor="22 80 65"
      backgroundColor={bgColor}
      borderRadius={borderRadius}
      glowRadius={36}
      glowIntensity={0.9}
      coneSpread={22}
      colors={
        isDark
          ? ['#e8621a', '#c04e10', '#ff8c42']
          : ['#e8621a', '#c04e10', '#ff8c42']
      }
      fillOpacity={0.18}
    >
      {children}
    </BorderGlow>
  );
}
