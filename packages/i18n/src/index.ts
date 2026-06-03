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
  'symbol.search': '搜尋商品',
  'settings.title': '設定',
  'settings.showGrid': '顯示網格',
  'status.connection': '連線',
  'status.locale': '語系',
  'status.ohlcvHint': '移動十字線查看 OHLCV',
  'context.fitContent': '適配畫面',
  'context.scrollRealtime': '跳到最新',
  'context.screenshot': '截圖',
  'context.deleteDrawing': '刪除繪圖',
};

const en: I18nDictionary = {
  'interval.1m': '1m',
  'interval.5m': '5m',
  'interval.15m': '15m',
  'interval.1h': '1h',
  'interval.4h': '4h',
  'interval.1D': 'D',
  'interval.1W': 'W',
  'toolbar.cursor': 'Cursor',
  'theme.dark': 'Theme',
  'theme.light': 'Light',
  'symbol.search': 'Symbol',
  'settings.title': 'Settings',
  'settings.showGrid': 'Show grid',
  'status.connection': 'Connection',
  'status.locale': 'Locale',
  'status.ohlcvHint': 'Move crosshair for OHLCV',
  'context.fitContent': 'Fit content',
  'context.scrollRealtime': 'Go to realtime',
  'context.screenshot': 'Screenshot',
  'context.deleteDrawing': 'Delete drawing',
};

let locale = 'zh-TW';
let dict: I18nDictionary = zhTW;
const plugins = new Map<string, I18nDictionary>();

export function setLocale(next: Locale): void {
  locale = next;
  dict = plugins.get(next) ?? (next === 'en' ? en : zhTW);
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