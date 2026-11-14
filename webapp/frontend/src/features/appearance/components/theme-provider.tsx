import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { parseTheme, readTheme, resolveTheme, THEME_KEY, type ThemeMode, type ResolvedTheme } from '../lib/theme';

interface ThemeContextValue { mode: ThemeMode; resolved: ResolvedTheme; setMode: (mode: ThemeMode) => void }
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, updateMode] = useState<ThemeMode>(readTheme);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolved = resolveTheme(mode, systemDark);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    const onStorage = (event: StorageEvent) => { if (event.key === THEME_KEY || event.key === null) updateMode(parseTheme(event.newValue)); };
    media.addEventListener('change', onChange);
    window.addEventListener('storage', onStorage);
    return () => { media.removeEventListener('change', onChange); window.removeEventListener('storage', onStorage); };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', resolved === 'dark' ? '#10121c' : '#f6f7fb');
  }, [resolved]);
  function setMode(next: ThemeMode) {
    updateMode(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* Keep the choice for this session when storage is blocked. */ }
  }
  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme requires ThemeProvider.');
  return value;
}
