import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';
import type { ThemeMode } from '../lib/theme';
const choices = [{ mode: 'light', label: 'Light', icon: Sun }, { mode: 'dark', label: 'Dark', icon: Moon }, { mode: 'system', label: 'System', icon: Monitor }] as const;
export function ThemeSelector({ compact = false }: { compact?: boolean }) {
  const { mode, setMode } = useTheme();
  // Native radio inputs provide arrow-key navigation as well as screen-reader state.
  return <fieldset className={compact ? 'theme-selector compact' : 'theme-selector'}><legend className="sr-only">Color theme</legend>{choices.map(({ mode: value, label, icon: Icon }) => <label key={value} className={mode === value ? 'theme-choice selected' : 'theme-choice'} title={`${label} theme`}>
    <input type="radio" name={compact ? 'header-theme' : 'appearance-theme'} value={value} checked={mode === value} onChange={() => setMode(value as ThemeMode)} />
    <Icon size={compact ? 16 : 24} /><span className={compact ? 'sr-only' : ''}>{label}</span>
  </label>)}</fieldset>;
}
