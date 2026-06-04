import type { IndicatorBuiltin } from './builtins.js';

export type IrIndicatorFn = IndicatorBuiltin;

export type IrOp =
  | { op: 'push'; value: number }
  | { op: 'load_series'; name: string }
  | { op: 'load_var'; name: string }
  | { op: 'store_var'; name: string }
  | {
      op: 'call_ind';
      fn: IrIndicatorFn;
      series: string;
      series2?: string;
    }
  | { op: 'add' }
  | { op: 'sub' }
  | { op: 'mul' }
  | { op: 'div' }
  | { op: 'neg' }
  | { op: 'not' }
  | { op: 'cmp'; mode: 'eq' | 'ne' | 'lt' | 'gt' | 'le' | 'ge' }
  | { op: 'and' }
  | { op: 'or' }
  | { op: 'pop' }
  | { op: 'jump'; target: number }
  | { op: 'jump_if_false'; target: number }
  | { op: 'plot'; title: string };

export interface PineIrProgram {
  version: 2;
  ops: IrOp[];
  vars: string[];
  plots: string[];
}