export type ThemeId = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'tradview:theme';

const THEME_VARS: Record<ThemeId, Record<string, string>> = {
  dark: {
    '--tv-bg': '#0d1117',
    '--tv-surface': '#161b22',
    '--tv-border': '#30363d',
    '--tv-fg': '#e6edf3',
    '--tv-muted': '#8b949e',
    '--tv-accent': '#388bfd',
    '--tv-btn-bg': '#21262d',
  },
  light: {
    '--tv-bg': '#ffffff',
    '--tv-surface': '#f6f8fa',
    '--tv-border': '#d0d7de',
    '--tv-fg': '#24292f',
    '--tv-muted': '#656d76',
    '--tv-accent': '#0969da',
    '--tv-btn-bg': '#f6f8fa',
  },
};

export function loadTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function applyThemeToDocument(theme: ThemeId, root: HTMLElement = document.documentElement): void {
  const vars = THEME_VARS[theme];
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.dataset.tradviewTheme = theme;
}

export interface ThemeProvider {
  getTheme(): ThemeId;
  setTheme(theme: ThemeId): void;
  toggle(): ThemeId;
  subscribe(listener: (theme: ThemeId) => void): () => void;
}

export function createThemeProvider(initial?: ThemeId): ThemeProvider {
  let theme: ThemeId = initial ?? loadTheme();
  const listeners = new Set<(t: ThemeId) => void>();

  const notify = () => {
    applyThemeToDocument(theme);
    for (const l of listeners) l(theme);
  };

  applyThemeToDocument(theme);

  return {
    getTheme: () => theme,
    setTheme: (next) => {
      if (next === theme) return;
      theme = next;
      saveTheme(theme);
      notify();
    },
    toggle: () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      saveTheme(theme);
      notify();
      return theme;
    },
    subscribe: (listener) => {
      listeners.add(listener);
      listener(theme);
      return () => listeners.delete(listener);
    },
  };
}