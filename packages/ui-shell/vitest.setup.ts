import { beforeEach, vi } from 'vitest';
import { resetLegacyLayoutWarningsForTests } from './src/layout-deprecation.js';

beforeEach(() => {
  resetLegacyLayoutWarningsForTests();
});