/** @deprecated Use settings-panel + user-preferences */
export {
  GRID_SETTING_KEY,
  loadShowGridPreference,
  saveShowGridPreference,
} from './user-preferences.js';
export type { SettingsPanelOptions as SettingsMenuOptions } from './settings-panel.js';
export { mountSettingsPanel as mountSettingsMenu } from './settings-panel.js';