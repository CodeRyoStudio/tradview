export type Locale = string;

export interface I18nDictionary {
  [key: string]: string;
}

const zhTW: I18nDictionary = {
  'interval.1m': '1 分',
  'interval.5m': '5 分',
  'interval.15m': '15 分',
  'interval.1h': '1 時',
  'interval.4h': '4 時',
  'interval.1D': '日',
  'interval.1W': '週',
  'toolbar.cursor': '游標',
  'theme.dark': '深色',
  'theme.light': '淺色',
};

let locale = 'zh-TW';
let dict: I18nDictionary = zhTW;
const plugins = new Map<string, I18nDictionary>();

export function setLocale(next: Locale): void {
  locale = next;
  dict = plugins.get(next) ?? (next === 'zh-TW' ? zhTW : zhTW);
}

export function registerLocale(loc: Locale, dictionary: I18nDictionary): void {
  plugins.set(loc, dictionary);
  if (locale === loc) dict = dictionary;
}

export function t(key: string, fallback?: string): string {
  return dict[key] ?? fallback ?? key;
}

export function getLocale(): Locale {
  return locale;
}