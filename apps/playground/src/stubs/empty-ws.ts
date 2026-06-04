/** Stub for Vite browser builds — real WS client uses globalThis.WebSocket. */
export class WebSocket {
  constructor() {
    throw new Error('Node ws package is not available in the browser playground');
  }
}