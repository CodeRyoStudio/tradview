import type { DataProviderCapabilities } from './types.js';

export const DEFAULT_DATA_PROVIDER_CAPABILITIES: DataProviderCapabilities = {
  historyModes: ['loadMore', 'range', 'cursor'],
  realtimeModes: ['bar', 'tick', 'bar+tick'],
  wsHistory: false,
  symbolSearch: true,
  encoding: ['json'],
};

export const MOCK_GATEWAY_CAPABILITIES: DataProviderCapabilities = {
  historyModes: ['loadMore', 'range', 'cursor'],
  realtimeModes: ['bar', 'tick', 'bar+tick'],
  wsHistory: true,
  symbolSearch: true,
  encoding: ['json', 'protobuf'],
};