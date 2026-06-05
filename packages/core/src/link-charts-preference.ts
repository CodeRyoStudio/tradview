/** Workspace default link toggle (ui-shell uses the same key). */
export const LINK_CHARTS_SETTING_KEY = 'tradview:settings:linkCharts';

export function loadLinkChartsPreference(): boolean {
  try {
    return localStorage.getItem(LINK_CHARTS_SETTING_KEY) === '1';
  } catch {
    return false;
  }
}