export const THEME_KEY = 'expense-tracker.theme';
export const THEME_MODES = ['light', 'dark', 'system'] as const;
export type ThemeMode = typeof THEME_MODES[number];
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;
export function parseTheme(value: string | null): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(mode: ThemeMode, systemDark: boolean): ResolvedTheme {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}
export function readTheme(): ThemeMode {
  try { return parseTheme(localStorage.getItem(THEME_KEY)); }
  catch { return 'system'; }
}
