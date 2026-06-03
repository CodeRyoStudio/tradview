import type { PineExpr, PineProgram, PineStmt } from './ast.js';
import { builtinArity, isBuiltin, SERIES_IDENTIFIERS } from './builtins.js';
import type { IrOp, PineIrProgram } from './ir.js';

class Emitter {
  ops: IrOp[] = [];
  private plotIndex = 0;

  emit(op: IrOp): number {
    this.ops.push(op);
    return this.ops.length - 1;
  }

  patchJump(index: number, target: number): void {
    const op = this.ops[index]!;
    if (op.op === 'jump' || op.op === 'jump_if_false') op.target = target;
  }

  emitExpr(expr: PineExpr, errors: string[], vars: Set<string>): boolean {
    switch (expr.kind) {
      case 'number':
        this.emit({ op: 'push', value: expr.value });
        return true;
      case 'bool':
        this.emit({ op: 'push', value: expr.value ? 1 : 0 });
        return true;
      case 'ident':
        if (vars.has(expr.name)) {
          this.emit({ op: 'load_var', name: expr.name });
          return true;
        }
        if (isBuiltin(expr.name) && builtinArity(expr.name) === 0) {
          this.emit({ op: 'load_series', name: expr.name });
          return true;
        }
        errors.push(`Unknown identifier '${expr.name}'`);
        return false;
      case 'unary':
        if (!this.emitExpr(expr.arg, errors, vars)) return false;
        this.emit({ op: expr.op === 'not' ? 'not' : 'neg' });
        return true;
      case 'binary':
        if (expr.op === 'and' || expr.op === 'or') {
          if (!this.emitExpr(expr.left, errors, vars) || !this.emitExpr(expr.right, errors, vars)) {
            return false;
          }
          this.emit({ op: expr.op });
          return true;
        }
        if (!this.emitExpr(expr.left, errors, vars) || !this.emitExpr(expr.right, errors, vars)) {
          return false;
        }
        if (expr.op === '+' || expr.op === '-' || expr.op === '*' || expr.op === '/') {
          this.emit({
            op: expr.op === '+' ? 'add' : expr.op === '-' ? 'sub' : expr.op === '*' ? 'mul' : 'div',
          });
          return true;
        }
        this.emit({
          op: 'cmp',
          mode:
            expr.op === '=='
              ? 'eq'
              : expr.op === '!='
                ? 'ne'
                : expr.op === '<'
                  ? 'lt'
                  : expr.op === '>'
                    ? 'gt'
                    : expr.op === '<='
                      ? 'le'
                      : 'ge',
        });
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
          if (!this.emitExpr(expr.args[1]!, errors, vars)) return false;
          this.emit({ op: 'call_ind', fn, series: expr.args[0].name });
          return true;
        }
        for (const arg of expr.args) {
          if (!this.emitExpr(arg, errors, vars)) return false;
        }
        return true;
      }
      default:
        return false;
    }
  }

  emitStmt(stmt: PineStmt, errors: string[], vars: Set<string>, plots: string[]): void {
    switch (stmt.kind) {
      case 'block':
        for (const s of stmt.body) this.emitStmt(s, errors, vars, plots);
        break;
      case 'var':
        vars.add(stmt.name);
        if (this.emitExpr(stmt.init, errors, vars)) this.emit({ op: 'store_var', name: stmt.name });
        break;
      case 'assign':
        if (!vars.has(stmt.name)) vars.add(stmt.name);
        if (this.emitExpr(stmt.value, errors, vars)) this.emit({ op: 'store_var', name: stmt.name });
        break;
      case 'plot': {
        if (!this.emitExpr(stmt.expr, errors, vars)) break;
        const title = stmt.title ?? `plot_${this.plotIndex++}`;
        plots.push(title);
        this.emit({ op: 'plot', title });
        break;
      }
      case 'expr':
        if (this.emitExpr(stmt.expr, errors, vars)) this.emit({ op: 'pop' });
        break;
      case 'if': {
        if (!this.emitExpr(stmt.cond, errors, vars)) break;
        const jmpFalse = this.emit({ op: 'jump_if_false', target: 0 });
        for (const s of stmt.then) this.emitStmt(s, errors, vars, plots);
        if (stmt.else?.length) {
          const jmpEnd = this.emit({ op: 'jump', target: 0 });
          this.patchJump(jmpFalse, this.ops.length);
          for (const s of stmt.else) this.emitStmt(s, errors, vars, plots);
          this.patchJump(jmpEnd, this.ops.length);
        } else {
          this.patchJump(jmpFalse, this.ops.length);
        }
        break;
      }
      case 'while': {
        const loopStart = this.ops.length;
        if (!this.emitExpr(stmt.cond, errors, vars)) break;
        const jmpEnd = this.emit({ op: 'jump_if_false', target: 0 });
        for (const s of stmt.body) this.emitStmt(s, errors, vars, plots);
        this.emit({ op: 'jump', target: loopStart });
        this.patchJump(jmpEnd, this.ops.length);
        break;
      }
      case 'for': {
        vars.add(stmt.name);
        if (!this.emitExpr(stmt.from, errors, vars)) break;
        this.emit({ op: 'store_var', name: stmt.name });
        const loopStart = this.ops.length;
        this.emit({ op: 'load_var', name: stmt.name });
        if (!this.emitExpr(stmt.to, errors, vars)) break;
        this.emit({ op: 'cmp', mode: 'le' });
        const jmpEnd = this.emit({ op: 'jump_if_false', target: 0 });
        for (const s of stmt.body) this.emitStmt(s, errors, vars, plots);
        this.emit({ op: 'load_var', name: stmt.name });
        this.emit({ op: 'push', value: 1 });
        this.emit({ op: 'add' });
        this.emit({ op: 'store_var', name: stmt.name });
        this.emit({ op: 'jump', target: loopStart });
        this.patchJump(jmpEnd, this.ops.length);
        break;
      }
    }
  }
}

export function compileAst(program: PineProgram): { ir: PineIrProgram | null; errors: string[] } {
  const errors: string[] = [];
  const vars = new Set<string>();
  const plots: string[] = [];
  const emitter = new Emitter();

  for (const stmt of program.body) {
    emitter.emitStmt(stmt, errors, vars, plots);
  }

  if (errors.length) return { ir: null, errors };

  return {
    ir: { version: 2, ops: emitter.ops, vars: [...vars], plots },
    errors,
  };
}