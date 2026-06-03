import { StreamLanguage } from '@codemirror/language';

export const pineLanguage = StreamLanguage.define({
  name: 'pine-lite',
  startState: () => ({}),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/\/\/.*/)) return 'comment';
    if (stream.match(/0x[\da-fA-F]+|\d+\.?\d*(?:[eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/\b(?:var|plot|if|else|while|for|to|and|or|not|true|false)\b/)) return 'keyword';
    if (stream.match(/\b(?:sma|ema|rsi|close|open|high|low|volume|hl2|hlc3)\b/)) return 'variableName';
    if (stream.match(/:=|==|!=|<=|>=|[+\-*/<>=(){},]/)) return 'operator';
    if (stream.match(/[A-Za-z_]\w*/)) return 'name';
    stream.next();
    return null;
  },
});