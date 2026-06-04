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
  'settings.close': '關閉',
  'settings.showGrid': '顯示網格',
  'toolbar.clearDrawings': '清除繪圖',
  'toolbar.clearIndicators': '清除指標',
  'status.connection': '連線',
  'status.locale': '語系',
  'status.ohlcvHint': '移動十字線查看 OHLCV',
  'context.fitContent': '適配畫面',
  'context.scrollRealtime': '跳到最新',
  'context.screenshot': '截圖',
  'context.deleteDrawing': '刪除繪圖',
  'drawing.props.title': '繪圖屬性',
  'drawing.props.type': '類型',
  'drawing.props.color': '顏色',
  'drawing.props.lineWidth': '線寬',
  'drawing.props.text': '文字',
  'drawing.props.locked': '已鎖定 — 解鎖後可編輯',
  'drawing.ctx.delete': '刪除',
  'drawing.ctx.copy': '複製',
  'drawing.ctx.lock': '鎖定',
  'drawing.ctx.unlock': '解鎖',
  'drawing.ctx.editText': '編輯文字',
  'drawing.ctx.deselect': '取消選取',
  'settings.tab.chart': '圖表',
  'settings.tab.drawing': '繪圖',
  'settings.tab.indicator': '指標',
  'settings.returnCursor': '畫完切回游標',
  'settings.ind.volume': '成交量副圖',
  'settings.ind.macd': 'MACD 窗格',
  'settings.ind.rsi': 'RSI 窗格',
  'settings.ind.kdj': 'KDJ 窗格',
  'settings.ind.source': '源',
  'settings.ind.clearAll': '清空所有指標',
  'settings.ind.layers': '指標圖層',
  'settings.ind.layersEmpty': '目前沒有指標',
  'settings.ind.layerMain': '主圖',
  'settings.ind.layerPane': '副圖',
  'settings.ind.layerRemove': '移除',
  'settings.drawing.clearAll': '清除所有畫線',
  'shortcuts.title': '快捷鍵',
  'shortcuts.close': '關閉',
  'layer.panel.title': '圖層',
  'layer.panel.open': '圖層',
  'layer.panel.createGroup': '建立群組',
  'layer.panel.removeFromGroup': '移出群組',
  'layer.panel.ungroup': '解散群組',
  'layer.panel.saveAs': '另存為我的範本',
  'layer.panel.select': '選取',
  'layer.panel.visibility': '顯示',
  'layer.panel.lock': '鎖定',
  'layer.preset.label': '版面範本',
  'layer.fork.name': '新範本名稱',
  'layer.editLayout': '編輯版面',
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
  'settings.close': 'Close',
  'settings.showGrid': 'Show grid',
  'toolbar.clearDrawings': 'Clear drawings',
  'toolbar.clearIndicators': 'Clear indicators',
  'status.connection': 'Connection',
  'status.locale': 'Locale',
  'status.ohlcvHint': 'Move crosshair for OHLCV',
  'context.fitContent': 'Fit content',
  'context.scrollRealtime': 'Go to realtime',
  'context.screenshot': 'Screenshot',
  'context.deleteDrawing': 'Delete drawing',
  'drawing.props.title': 'Drawing',
  'drawing.props.type': 'Type',
  'drawing.props.color': 'Color',
  'drawing.props.lineWidth': 'Line width',
  'drawing.props.text': 'Text',
  'drawing.props.locked': 'Locked',
  'drawing.ctx.delete': 'Delete',
  'drawing.ctx.copy': 'Copy',
  'drawing.ctx.lock': 'Lock',
  'drawing.ctx.unlock': 'Unlock',
  'drawing.ctx.editText': 'Edit text',
  'drawing.ctx.deselect': 'Deselect',
  'settings.tab.chart': 'Chart',
  'settings.tab.drawing': 'Drawing',
  'settings.tab.indicator': 'Indicators',
  'settings.returnCursor': 'Return to cursor after draw',
  'settings.ind.volume': 'Volume pane',
  'settings.ind.macd': 'MACD pane',
  'settings.ind.rsi': 'RSI pane',
  'settings.ind.kdj': 'KDJ pane',
  'settings.ind.source': 'Source',
  'settings.ind.clearAll': 'Clear all indicators',
  'settings.ind.layers': 'Indicator layers',
  'settings.ind.layersEmpty': 'No indicators',
  'settings.ind.layerMain': 'Main chart',
  'settings.ind.layerPane': 'Sub chart',
  'settings.ind.layerRemove': 'Remove',
  'settings.drawing.clearAll': 'Clear all drawings',
  'shortcuts.title': 'Shortcuts',
  'shortcuts.close': 'Close',
  'layer.panel.title': 'Layers',
  'layer.panel.open': 'Layers',
  'layer.panel.createGroup': 'Create group',
  'layer.panel.removeFromGroup': 'Remove from group',
  'layer.panel.ungroup': 'Ungroup',
  'layer.panel.saveAs': 'Save as my preset',
  'layer.panel.select': 'Select',
  'layer.panel.visibility': 'Visibility',
  'layer.panel.lock': 'Lock',
  'layer.preset.label': 'Layout preset',
  'layer.fork.name': 'New preset name',
  'layer.editLayout': 'Edit layout',
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