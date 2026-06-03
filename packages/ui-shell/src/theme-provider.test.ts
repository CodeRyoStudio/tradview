import { describe, expect, it, beforeEach } from 'vitest';
import { createThemeProvider, loadTheme, saveTheme, applyThemeToDocument } from './theme-provider.js';

describe('createThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-tradview-theme');
  });

  it('defaults to dark and persists toggle', () => {
    const tp = createThemeProvider();
    expect(tp.getTheme()).toBe('dark');
    expect(tp.toggle()).toBe('light');
    expect(loadTheme()).toBe('light');
    saveTheme('dark');
    expect(loadTheme()).toBe('dark');
  });

  it('applies CSS variables to document', () => {
    applyThemeToDocument('light');
    expect(document.documentElement.dataset.tradviewTheme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--tv-bg')).toBe('#ffffff');
  });
});