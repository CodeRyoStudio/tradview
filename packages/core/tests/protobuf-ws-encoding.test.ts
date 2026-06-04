import { describe, expect, it, vi } from 'vitest';
import type { DataProvider, DataProviderCapabilities } from '@coderyo/data';
import { ChartController } from '../src/chart-controller.js';
import { resolveChartFeatures } from '../src/chart-features.js';

type ProtobufHarness = {
  ctrl: ChartController;
  setWsEncoding: ReturnType<typeof vi.fn>;
  errors: unknown[];
};

function makeProtobufHarness(opts: {
  protobuf: boolean;
  encoding?: DataProviderCapabilities['encoding'];
  includeSetWsEncoding?: boolean;
}): ProtobufHarness {
  const setWsEncoding = vi.fn();
  const errors: unknown[] = [];
  const encoding = opts.encoding ?? ['json', 'protobuf'];

  const dataProvider: DataProvider = {
    getCapabilities: vi.fn().mockResolvedValue({
      historyModes: ['loadMore'],
      realtimeModes: ['bar'],
      encoding,
    }),
    getHistory: vi.fn().mockResolvedValue({ bars: [], hasMore: false }),
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
  };
  if (opts.includeSetWsEncoding !== false) {
    dataProvider.setWsEncoding = setWsEncoding;
  }

  const ctrl = Object.create(ChartController.prototype) as ChartController;
  Object.defineProperty(ctrl, 'handlers', {
    value: new Map(),
    configurable: true,
  });
  Object.defineProperty(ctrl, 'features', {
    value: resolveChartFeatures({ protobuf: opts.protobuf }),
    configurable: true,
  });
  Object.defineProperty(ctrl, 'options', {
    value: { dataProvider },
    configurable: true,
  });

  ctrl.on('error', (payload) => errors.push(payload));

  return { ctrl, setWsEncoding, errors };
}

async function runApplyProtobuf(ctrl: ChartController): Promise<void> {
  const apply = (
    ChartController.prototype as unknown as {
      applyProtobufWsEncodingIfEnabled: () => Promise<void>;
    }
  ).applyProtobufWsEncodingIfEnabled;
  await apply.call(ctrl);
}

describe('ChartController protobuf WS encoding (PR-02b-2)', () => {
  it('does not call setWsEncoding when features.protobuf is false', async () => {
    const { ctrl, setWsEncoding } = makeProtobufHarness({ protobuf: false });
    await runApplyProtobuf(ctrl);
    expect(setWsEncoding).not.toHaveBeenCalled();
  });

  it('calls setWsEncoding("protobuf") when protobuf is true and capabilities allow', async () => {
    const { ctrl, setWsEncoding, errors } = makeProtobufHarness({
      protobuf: true,
      encoding: ['json', 'protobuf'],
    });
    await runApplyProtobuf(ctrl);
    expect(setWsEncoding).toHaveBeenCalledTimes(1);
    expect(setWsEncoding).toHaveBeenCalledWith('protobuf');
    expect(errors).toHaveLength(0);
  });

  it('emits PROTOBUF_UNAVAILABLE when protobuf is true but capabilities omit protobuf', async () => {
    const { ctrl, setWsEncoding, errors } = makeProtobufHarness({
      protobuf: true,
      encoding: ['json'],
    });
    await runApplyProtobuf(ctrl);
    expect(setWsEncoding).not.toHaveBeenCalled();
    expect(errors).toEqual([
      {
        code: 'PROTOBUF_UNAVAILABLE',
        message: 'Data provider does not advertise protobuf in capabilities.encoding',
      },
    ]);
  });
});