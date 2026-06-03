export type IrOp =
  | { op: 'push'; value: number }
  | { op: 'load_series'; name: string }
  | { op: 'load_var'; name: string }
  | { op: 'store_var'; name: string }
  | { op: 'call'; name: string; argc: number }
  | { op: 'call_ind'; fn: 'sma' | 'ema' | 'rsi'; series: string }
  | { op: 'add' }
  | { op: 'sub' }
  | { op: 'mul' }
  | { op: 'div' }
  | { op: 'neg' }
  | { op: 'plot'; title: string };

export interface PineIrProgram {
  version: 1;
  ops: IrOp[];
  vars: string[];
  plots: string[];
}