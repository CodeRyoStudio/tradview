import { describe, expect, it, vi } from 'vitest';
import { createDefaultBridge } from '../src/index.js';

describe('BridgeAdapter origin policy (review #3)', () => {
  it('rejects inbound postMessage from disallowed origin', () => {
    const handler = vi.fn();
    const bridge = createDefaultBridge({
      origin: 'https://app.example',
      allowInboundOrigins: ['https://app.example'],
    });
    bridge.onMessage(handler);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'host.setSymbol', payload: { chartId: 'c1', symbol: 'X' } },
        origin: 'https://evil.example',
      }),
    );
    expect(handler).not.toHaveBeenCalled();

    window.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'host.setSymbol', payload: { chartId: 'c1', symbol: 'X' } },
        origin: 'https://app.example',
      }),
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});