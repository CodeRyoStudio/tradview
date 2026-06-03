import type { Token } from './tokens.js';

const KEYWORDS = new Set(['var', 'plot']);

export function tokenize(source: string): { tokens: Token[]; errors: string[] } {
  const tokens: Token[] = [];
  const errors: string[] = [];
  let i = 0;

  const push = (type: Token['type'], value: string, pos: number) => {
    tokens.push({ type, value, pos });
  };

  while (i < source.length) {
    const pos = i;
    const ch = source[i]!;

    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '/') {
      i += 2;
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch >= '0' && ch <= '9') {
      let j = i + 1;
      while (j < source.length && /[0-9.]/.test(source[j]!)) j++;
      push('number', source.slice(i, j), pos);
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j]!)) j++;
      const word = source.slice(i, j);
      if (KEYWORDS.has(word)) push(word as 'var' | 'plot', word, pos);
      else push('ident', word, pos);
      i = j;
      continue;
    }
    if (ch === ':' && source[i + 1] === '=') {
      push('assign', ':=', pos);
      i += 2;
      continue;
    }
    if (ch === '=') {
      push('eq', '=', pos);
      i++;
      continue;
    }
    if (ch === '(') {
      push('lparen', '(', pos);
      i++;
      continue;
    }
    if (ch === ')') {
      push('rparen', ')', pos);
      i++;
      continue;
    }
    if (ch === ',') {
      push('comma', ',', pos);
      i++;
      continue;
    }
    if (ch === '+') {
      push('plus', '+', pos);
      i++;
      continue;
    }
    if (ch === '-') {
      push('minus', '-', pos);
      i++;
      continue;
    }
    if (ch === '*') {
      push('star', '*', pos);
      i++;
      continue;
    }
    if (ch === '/') {
      push('slash', '/', pos);
      i++;
      continue;
    }
    errors.push(`Unexpected character '${ch}' at ${pos}`);
    i++;
  }

  tokens.push({ type: 'eof', value: '', pos: i });
  return { tokens, errors };
}