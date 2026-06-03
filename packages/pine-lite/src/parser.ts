import type { PineExpr, PineProgram, PineStmt } from './ast.js';
import type { Token } from './tokens.js';

export function parseProgram(tokens: Token[]): {
  program: PineProgram | null;
  errors: Array<{ message: string; line: number; col: number }>;
} {
  const errors: Array<{ message: string; line: number; col: number }> = [];
  let i = 0;

  const peek = () => tokens[i]!;
  const at = (t: Token['type']) => peek().type === t;
  const err = (msg: string) => {
    errors.push({ message: msg, line: peek().line, col: peek().col });
  };
  const eat = (t: Token['type']) => {
    if (!at(t)) {
      err(`Expected ${t}, got ${peek().type}`);
      return false;
    }
    i++;
    return true;
  };

  const parseBlock = (): PineStmt[] => {
    if (at('lbrace')) {
      i++;
      const body: PineStmt[] = [];
      while (!at('rbrace') && !at('eof')) {
        const stmt = parseStmt();
        if (!stmt) break;
        body.push(stmt);
      }
      if (!eat('rbrace')) return body;
      return body;
    }
    const stmt = parseStmt();
    return stmt ? [stmt] : [];
  };

  const parseOr = (): PineExpr | null => {
    let left = parseAnd();
    if (!left) return null;
    while (at('or')) {
      i++;
      const right = parseAnd();
      if (!right) return null;
      left = { kind: 'binary', op: 'or', left, right };
    }
    return left;
  };

  const parseAnd = (): PineExpr | null => {
    let left = parseCompare();
    if (!left) return null;
    while (at('and')) {
      i++;
      const right = parseCompare();
      if (!right) return null;
      left = { kind: 'binary', op: 'and', left, right };
    }
    return left;
  };

  const parseCompare = (): PineExpr | null => {
    let left = parseAdd();
    if (!left) return null;
    const cmpTypes = ['eq', 'ne', 'lt', 'gt', 'le', 'ge'] as const;
    while (cmpTypes.some((t) => at(t))) {
      const t = peek().type as (typeof cmpTypes)[number];
      const opMap = {
        eq: '==',
        ne: '!=',
        lt: '<',
        gt: '>',
        le: '<=',
        ge: '>=',
      } as const;
      i++;
      const right = parseAdd();
      if (!right) return null;
      left = { kind: 'binary', op: opMap[t], left, right };
    }
    return left;
  };

  const parseAdd = (): PineExpr | null => {
    let left = parseMul();
    if (!left) return null;
    while (at('plus') || at('minus')) {
      const op = peek().type === 'plus' ? '+' : '-';
      i++;
      const right = parseMul();
      if (!right) return null;
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseMul = (): PineExpr | null => {
    let left = parseUnary();
    if (!left) return null;
    while (at('star') || at('slash')) {
      const op = peek().type === 'star' ? '*' : '/';
      i++;
      const right = parseUnary();
      if (!right) return null;
      left = { kind: 'binary', op, left, right };
    }
    return left;
  };

  const parseUnary = (): PineExpr | null => {
    if (at('not')) {
      i++;
      const arg = parseUnary();
      return arg ? { kind: 'unary', op: 'not', arg } : null;
    }
    if (at('minus')) {
      i++;
      const arg = parseUnary();
      return arg ? { kind: 'unary', op: '-', arg } : null;
    }
    return parsePrimary();
  };

  const parsePrimary = (): PineExpr | null => {
    const t = peek();
    if (t.type === 'number') {
      i++;
      return { kind: 'number', value: Number(t.value) };
    }
    if (t.type === 'true' || t.type === 'false') {
      i++;
      return { kind: 'bool', value: t.type === 'true' };
    }
    if (t.type === 'ident') {
      const name = t.value;
      i++;
      if (at('lparen')) {
        i++;
        const args: PineExpr[] = [];
        if (!at('rparen')) {
          const first = parseOr();
          if (!first) return null;
          args.push(first);
          while (at('comma')) {
            i++;
            const next = parseOr();
            if (!next) return null;
            args.push(next);
          }
        }
        if (!eat('rparen')) return null;
        return { kind: 'call', name, args };
      }
      return { kind: 'ident', name };
    }
    if (at('lparen')) {
      i++;
      const inner = parseOr();
      if (!inner || !eat('rparen')) return null;
      return inner;
    }
    err(`Unexpected token ${t.type}`);
    return null;
  };

  const parseStmt = (): PineStmt | null => {
    if (at('if')) {
      i++;
      if (!eat('lparen')) return null;
      const cond = parseOr();
      if (!cond || !eat('rparen')) return null;
      const then = parseBlock();
      let elseBody: PineStmt[] | undefined;
      if (at('else')) {
        i++;
        elseBody = parseBlock();
      }
      return { kind: 'if', cond, then, else: elseBody };
    }
    if (at('while')) {
      i++;
      if (!eat('lparen')) return null;
      const cond = parseOr();
      if (!cond || !eat('rparen')) return null;
      const body = parseBlock();
      return { kind: 'while', cond, body };
    }
    if (at('for')) {
      i++;
      if (!at('ident')) {
        err('Expected loop variable after for');
        return null;
      }
      const name = peek().value;
      i++;
      if (!eat('eq')) return null;
      const from = parseOr();
      if (!from || !at('to')) {
        err('Expected "to" in for loop');
        return null;
      }
      i++;
      const to = parseOr();
      if (!to) return null;
      const body = parseBlock();
      return { kind: 'for', name, from, to, body };
    }
    if (at('var')) {
      i++;
      if (!at('ident')) {
        err('Expected identifier after var');
        return null;
      }
      const name = peek().value;
      i++;
      if (!eat('eq')) return null;
      const init = parseOr();
      return init ? { kind: 'var', name, init } : null;
    }
    if (at('plot')) {
      i++;
      if (!eat('lparen')) return null;
      const expr = parseOr();
      if (!expr || !eat('rparen')) return null;
      return { kind: 'plot', expr };
    }
    if (at('ident')) {
      const name = peek().value;
      i++;
      if (at('assign') || at('eq')) {
        i++;
        const value = parseOr();
        return value ? { kind: 'assign', name, value } : null;
      }
      i--;
      const expr = parseOr();
      return expr ? { kind: 'expr', expr } : null;
    }
    if (at('lbrace')) {
      return { kind: 'block', body: parseBlock() };
    }
    err(`Unexpected statement ${peek().type}`);
    return null;
  };

  const body: PineStmt[] = [];
  while (!at('eof')) {
    const stmt = parseStmt();
    if (!stmt) break;
    body.push(stmt);
  }

  if (!at('eof')) err('Unexpected tokens after program end');
  return { program: { kind: 'program', body }, errors };
}