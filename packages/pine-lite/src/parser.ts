import type { PineExpr, PineProgram, PineStmt } from './ast.js';
import type { Token } from './tokens.js';

export function parseProgram(tokens: Token[]): { program: PineProgram | null; errors: string[] } {
  const errors: string[] = [];
  let i = 0;

  const peek = () => tokens[i]!;
  const at = (t: Token['type']) => peek().type === t;
  const eat = (t: Token['type']) => {
    if (!at(t)) {
      errors.push(`Expected ${t} at ${peek().pos}, got ${peek().type}`);
      return false;
    }
    i++;
    return true;
  };

  const parseExpr = (): PineExpr | null => {
    return parseAdd();
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
    if (t.type === 'ident') {
      const name = t.value;
      i++;
      if (at('lparen')) {
        i++;
        const args: PineExpr[] = [];
        if (!at('rparen')) {
          const first = parseExpr();
          if (!first) return null;
          args.push(first);
          while (at('comma')) {
            i++;
            const next = parseExpr();
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
      const inner = parseExpr();
      if (!inner || !eat('rparen')) return null;
      return inner;
    }
    errors.push(`Unexpected token ${t.type} at ${t.pos}`);
    return null;
  };

  const parseStmt = (): PineStmt | null => {
    if (at('var')) {
      i++;
      if (!at('ident')) {
        errors.push(`Expected identifier after var at ${peek().pos}`);
        return null;
      }
      const name = peek().value;
      i++;
      if (!eat('eq')) return null;
      const init = parseExpr();
      return init ? { kind: 'var', name, init } : null;
    }
    if (at('plot')) {
      i++;
      if (!eat('lparen')) return null;
      const expr = parseExpr();
      if (!expr || !eat('rparen')) return null;
      return { kind: 'plot', expr };
    }
    if (at('ident')) {
      const name = peek().value;
      i++;
      if (at('assign') || at('eq')) {
        i++;
        const value = parseExpr();
        return value ? { kind: 'assign', name, value } : null;
      }
      i--;
      const expr = parseExpr();
      return expr ? { kind: 'expr', expr } : null;
    }
    errors.push(`Unexpected statement at ${peek().pos}`);
    return null;
  };

  const body: PineStmt[] = [];
  while (!at('eof')) {
    const stmt = parseStmt();
    if (!stmt) break;
    body.push(stmt);
  }

  if (!at('eof')) errors.push('Trailing tokens after program end');
  return { program: { kind: 'program', body }, errors };
}