export type TokenType =
  | 'number'
  | 'ident'
  | 'var'
  | 'plot'
  | 'if'
  | 'else'
  | 'while'
  | 'for'
  | 'to'
  | 'and'
  | 'or'
  | 'not'
  | 'true'
  | 'false'
  | 'assign'
  | 'eq'
  | 'ne'
  | 'lt'
  | 'gt'
  | 'le'
  | 'ge'
  | 'lbrace'
  | 'rbrace'
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
  line: number;
  col: number;
}