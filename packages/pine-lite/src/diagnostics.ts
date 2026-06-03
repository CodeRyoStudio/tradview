export interface PineDiagnostic {
  line: number;
  col: number;
  message: string;
  severity: 'error' | 'warning';
  endCol?: number;
}

export function offsetToLineCol(source: string, offset: number): { line: number; col: number } {
  let line = 1;
  let col = 1;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

export function diagnosticFromMessage(source: string, message: string): PineDiagnostic {
  const at = message.match(/\bat\s+(\d+)\b/);
  if (at) {
    const pos = Number(at[1]);
    const { line, col } = offsetToLineCol(source, pos);
    return { line, col, message: message.replace(/\s+at\s+\d+\s*$/, ''), severity: 'error' };
  }
  return { line: 1, col: 1, message, severity: 'error' };
}

export function diagnosticsFromMessages(source: string, messages: string[]): PineDiagnostic[] {
  return messages.map((m) => diagnosticFromMessage(source, m));
}