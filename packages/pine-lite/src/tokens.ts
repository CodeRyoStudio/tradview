export type TokenType =
  | 'number'
  | 'ident'
  | 'var'
  | 'plot'
  | 'assign' // :=
  | 'eq' // =
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'eof';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}