import { useEffect } from 'react';
import { useShared } from '@/context/SharedContext';

export function useTheme() {
  const { state, dispatch } = useShared();
  const { theme } = state;

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved && saved !== theme) {
      dispatch({ type: 'SET_THEME', value: saved === 'dark' ? 'dark' : 'light' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    document.body.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    dispatch({ type: 'SET_THEME', value: next });
    localStorage.setItem('theme', next);
  }

  return { theme, toggleTheme };
}
