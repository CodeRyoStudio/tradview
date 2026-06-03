import {
  getLocale,
  registerLocale,
  setLocale,
  t as i18nT,
  type I18nDictionary,
  type Locale,
} from '@coderyo/i18n';

export interface I18nProvider {
  t(key: string, fallback?: string, params?: Record<string, string | number>): string;
  getLocale(): Locale;
  setLocale(locale: Locale): void;
  registerLocale(locale: Locale, dictionary: I18nDictionary): void;
  subscribe(listener: (locale: Locale) => void): () => void;
}

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function createI18nProvider(defaultLocale: Locale = 'zh-TW'): I18nProvider {
  setLocale(defaultLocale);
  const listeners = new Set<(locale: Locale) => void>();

  return {
    t(key, fallback, params) {
      return interpolate(i18nT(key, fallback), params);
    },
    getLocale,
    setLocale(locale) {
      setLocale(locale);
      for (const l of listeners) l(locale);
    },
    registerLocale(loc, dictionary) {
      registerLocale(loc, dictionary);
      if (getLocale() === loc) {
        for (const l of listeners) l(loc);
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(getLocale());
      return () => listeners.delete(listener);
    },
  };
}