export type PineExpr =
  | { kind: 'number'; value: number }
  | { kind: 'ident'; name: string }
  | { kind: 'unary'; op: '-'; arg: PineExpr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/'; left: PineExpr; right: PineExpr }
  | { kind: 'call'; name: string; args: PineExpr[] };

export type PineStmt =
  | { kind: 'var'; name: string; init: PineExpr }
  | { kind: 'assign'; name: string; value: PineExpr }
  | { kind: 'plot'; expr: PineExpr; title?: string }
  | { kind: 'expr'; expr: PineExpr };

export interface PineProgram {
  kind: 'program';
  body: PineStmt[];
}