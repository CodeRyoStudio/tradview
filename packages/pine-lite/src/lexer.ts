import type { Token } from './tokens.js';

const KEYWORDS: Record<string, Token['type']> = {
  var: 'var',
  plot: 'plot',
  if: 'if',
  else: 'else',
  while: 'while',
  for: 'for',
  to: 'to',
  and: 'and',
  or: 'or',
  not: 'not',
  true: 'true',
  false: 'false',
};

export function tokenize(source: string): { tokens: Token[]; errors: string[] } {
  const tokens: Token[] = [];
  const errors: string[] = [];
  let i = 0;
  let line = 1;
  let col = 1;

  const push = (type: Token['type'], value: string, pos: number, startLine: number, startCol: number) => {
    tokens.push({ type, value, pos, line: startLine, col: startCol });
  };

  while (i < source.length) {
    const pos = i;
    const startLine = line;
    const startCol = col;
    const ch = source[i]!;

    if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++;
      col++;
      continue;
    }
    if (ch === '\n') {
      i++;
      line++;
      col = 1;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      col += 2;
      while (i < source.length && source[i] !== '\n') {
        i++;
        col++;
      }
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j++;
      const raw = source.slice(i, j);
      push('number', raw, pos, startLine, startCol);
      col += j - i;
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j++;
      const word = source.slice(i, j);
      const kw = KEYWORDS[word];
      push(kw ?? 'ident', word, pos, startLine, startCol);
      col += j - i;
      i = j;
      continue;
    }
    if (ch === ':' && source[i + 1] === '=') {
      push('assign', ':=', pos, startLine, startCol);
      i += 2;
      col += 2;
      continue;
    }
    if (ch === '=' && source[i + 1] === '=') {
      push('eq', '==', pos, startLine, startCol);
      i += 2;
      col += 2;
      continue;
    }
    if (ch === '!' && source[i + 1] === '=') {
      push('ne', '!=', pos, startLine, startCol);
      i += 2;
      col += 2;
      continue;
    }
    if (ch === '<' && source[i + 1] === '=') {
      push('le', '<=', pos, startLine, startCol);
      i += 2;
      col += 2;
      continue;
    }
    if (ch === '>' && source[i + 1] === '=') {
      push('ge', '>=', pos, startLine, startCol);
      i += 2;
      col += 2;
      continue;
    }
    if (ch === '<') {
      push('lt', '<', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '>') {
      push('gt', '>', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '{') {
      push('lbrace', '{', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '}') {
      push('rbrace', '}', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '(') {
      push('lparen', '(', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === ')') {
      push('rparen', ')', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === ',') {
      push('comma', ',', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '+') {
      push('plus', '+', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '-') {
      push('minus', '-', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '*') {
      push('star', '*', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '/') {
      push('slash', '/', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }
    if (ch === '=') {
      push('eq', '=', pos, startLine, startCol);
      i++;
      col++;
      continue;
    }

    errors.push(`Unexpected '${ch}' at line ${startLine}, col ${startCol}`);
    i++;
    col++;
  }

  tokens.push({ type: 'eof', value: '', pos: i, line, col });
  return { tokens, errors };
}