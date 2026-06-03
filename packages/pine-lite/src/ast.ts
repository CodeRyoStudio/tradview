export type PineExpr =
  | { kind: 'number'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'ident'; name: string }
  | { kind: 'unary'; op: '-' | 'not'; arg: PineExpr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '==' | '!=' | '<' | '>' | '<=' | '>=' | 'and' | 'or'; left: PineExpr; right: PineExpr }
  | { kind: 'call'; name: string; args: PineExpr[] };

export type PineStmt =
  | { kind: 'var'; name: string; init: PineExpr }
  | { kind: 'assign'; name: string; value: PineExpr }
  | { kind: 'plot'; expr: PineExpr; title?: string }
  | { kind: 'expr'; expr: PineExpr }
  | { kind: 'if'; cond: PineExpr; then: PineStmt[]; else?: PineStmt[] }
  | { kind: 'while'; cond: PineExpr; body: PineStmt[] }
  | { kind: 'for'; name: string; from: PineExpr; to: PineExpr; body: PineStmt[] }
  | { kind: 'block'; body: PineStmt[] };

export interface PineProgram {
  kind: 'program';
  body: PineStmt[];
}