import { ChevronDown, Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';
import { THEME_MODES, type ThemeMode } from '../lib/theme';

const themeIcons = { light: Sun, dark: Moon, system: Monitor };

export function ThemeDropdown() {
  const { mode, setMode } = useTheme();
  const ThemeIcon = themeIcons[mode];
  return (
    <label className="header-theme-control">
      <span className="sr-only">Color theme</span>
      <ThemeIcon size={16} className="header-theme-icon" aria-hidden="true" />
      <select value={mode} onChange={(event) => setMode(event.target.value as ThemeMode)}>
        {THEME_MODES.map((value) => (
          <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)} theme</option>
        ))}
      </select>
      <ChevronDown size={13} className="header-theme-chevron" aria-hidden="true" />
    </label>
  );
}
