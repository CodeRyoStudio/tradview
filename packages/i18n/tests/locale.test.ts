import { describe, expect, it } from 'vitest';
import { getLocale, setLocale, t } from '../src/index.js';

describe('i18n', () => {
  it('defaults to zh-TW strings', () => {
    setLocale('zh-TW');
    expect(getLocale()).toBe('zh-TW');
    expect(t('settings.showGrid')).toBe('顯示網格');
  });

  it('switches to en via setLocale', () => {
    setLocale('en');
    expect(t('settings.showGrid')).toBe('Show grid');
    setLocale('zh-TW');
  });
});