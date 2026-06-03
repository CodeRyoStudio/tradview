import type { PineExpr, PineProgram, PineStmt } from './ast.js';
import { builtinArity, isBuiltin, SERIES_IDENTIFIERS } from './builtins.js';
import type { IrOp, PineIrProgram } from './ir.js';

export function compileAst(program: PineProgram): { ir: PineIrProgram | null; errors: string[] } {
  const errors: string[] = [];
  const ops: IrOp[] = [];
  const vars = new Set<string>();
  const plots: string[] = [];
  let plotIndex = 0;

  const emitExpr = (expr: PineExpr): boolean => {
    switch (expr.kind) {
      case 'number':
        ops.push({ op: 'push', value: expr.value });
        return true;
      case 'ident':
        if (vars.has(expr.name)) {
          ops.push({ op: 'load_var', name: expr.name });
          return true;
        }
        if (isBuiltin(expr.name) && builtinArity(expr.name) === 0) {
          ops.push({ op: 'load_series', name: expr.name });
          return true;
        }
        errors.push(`Unknown identifier '${expr.name}'`);
        return false;
      case 'unary':
        if (!emitExpr(expr.arg)) return false;
        ops.push({ op: 'neg' });
        return true;
      case 'binary':
        if (!emitExpr(expr.left) || !emitExpr(expr.right)) return false;
        ops.push({ op: expr.op === '+' ? 'add' : expr.op === '-' ? 'sub' : expr.op === '*' ? 'mul' : 'div' });
        return true;
      case 'call': {
        const arity = builtinArity(expr.name);
        if (arity == null) {
          errors.push(`Unknown function '${expr.name}'`);
          return false;
        }
        if (expr.args.length !== arity) {
          errors.push(`'${expr.name}' expects ${arity} arguments, got ${expr.args.length}`);
          return false;
        }
        const fn = expr.name as 'sma' | 'ema' | 'rsi';
        if (
          (fn === 'sma' || fn === 'ema' || fn === 'rsi') &&
          expr.args[0]?.kind === 'ident' &&
          SERIES_IDENTIFIERS.has(expr.args[0].name)
        ) {
          if (!emitExpr(expr.args[1]!)) return false;
          ops.push({ op: 'call_ind', fn, series: expr.args[0].name });
          return true;
        }
        for (const arg of expr.args) {
          if (!emitExpr(arg)) return false;
        }
        ops.push({ op: 'call', name: expr.name, argc: arity });
        return true;
      }
      default:
        return false;
    }
  };

  for (const stmt of program.body) {
    switch (stmt.kind) {
      case 'var':
        vars.add(stmt.name);
        if (!emitExpr(stmt.init)) return { ir: null, errors };
        ops.push({ op: 'store_var', name: stmt.name });
        break;
      case 'assign':
        if (!vars.has(stmt.name)) vars.add(stmt.name);
        if (!emitExpr(stmt.value)) return { ir: null, errors };
        ops.push({ op: 'store_var', name: stmt.name });
        break;
      case 'plot': {
        if (!emitExpr(stmt.expr)) return { ir: null, errors };
        const title = stmt.title ?? `plot_${plotIndex++}`;
        plots.push(title);
        ops.push({ op: 'plot', title });
        break;
      }
      case 'expr':
        if (!emitExpr(stmt.expr)) return { ir: null, errors };
        break;
    }
  }

  return {
    ir: { version: 1, ops, vars: [...vars], plots },
    errors,
  };
}