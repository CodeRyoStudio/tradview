import http from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseInterval } from '../interval.js';
import type { Envelope } from '../types.js';
import { floorBarOpenTime, generateBars, seedNextBar } from './bar-generator.js';
import { resolveHistoryBars } from './bar-generator.js';

export interface MockWsServerOptions {
  port: number;
  host?: string;
}

interface Subscription {
  id: string;
  symbol: string;
  interval: ReturnType<typeof parseInterval>;
  streamMode: 'bar' | 'tick' | 'bar+tick';
  timer?: ReturnType<typeof setInterval>;
}

function send(ws: WebSocket, msg: Envelope) {
  ws.send(JSON.stringify({ ts: Date.now(), ...msg, v: msg.v ?? '1.0' }));
}

function parseMessage(raw: string): Envelope | null {
  try {
    return JSON.parse(raw) as Envelope;
  } catch {
    return null;
  }
}

export function attachMockWebSocket(server: http.Server): WebSocketServer {
  const wss = new WebSocketServer({ server });
  const subs = new Map<WebSocket, Map<string, Subscription>>();

  wss.on('connection', (ws) => {
    subs.set(ws, new Map());

    ws.on('message', (data) => {
      const text = typeof data === 'string' ? data : data.toString('utf8');
      const msg = parseMessage(text);
      if (!msg?.type) return;

      const clientSubs = subs.get(ws)!;
      const replyId = msg.id;

      if (msg.type === 'ping') {
        send(ws, { v: '1.0', type: 'pong', ts: Date.now(), payload: {} });
        return;
      }

      if (msg.type === 'auth' || msg.type === 'auth.refresh') {
        send(ws, {
          v: '1.0',
          id: replyId,
          type: 'auth.ok',
          payload: { sessionId: `mock-${Date.now()}` },
        });
        return;
      }

      if (msg.type === 'subscribe') {
        const p = msg.payload as {
          symbol: string;
          interval: string;
          channels?: string[];
          streamMode?: string;
        };
        try {
          const interval = parseInterval(p.interval);
          const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const streamMode = (p.streamMode ?? 'bar') as Subscription['streamMode'];

          const sub: Subscription = { id: subId, symbol: p.symbol, interval, streamMode };
          clientSubs.set(subId, sub);

          send(ws, {
            v: '1.0',
            id: replyId,
            type: 'subscribe.ok',
            payload: { subscriptionId: subId, symbol: p.symbol, interval },
          });

          if (p.channels?.includes('bar') || streamMode === 'bar' || streamMode === 'bar+tick') {
            startBarPush(ws, sub);
          }
        } catch {
          send(ws, {
            v: '1.0',
            id: replyId,
            type: 'error',
            payload: { code: 'INVALID_INTERVAL', message: 'Invalid interval' },
          });
        }
        return;
      }

      if (msg.type === 'unsubscribe') {
        const p = msg.payload as { subscriptionId: string };
        const sub = clientSubs.get(p.subscriptionId);
        if (sub?.timer) clearInterval(sub.timer);
        clientSubs.delete(p.subscriptionId);
        send(ws, {
          v: '1.0',
          id: replyId,
          type: 'unsubscribe.ok',
          payload: { subscriptionId: p.subscriptionId },
        });
        return;
      }

      if (msg.type === 'history.request') {
        const p = msg.payload as {
          symbol: string;
          interval: string;
          from: number;
          to: number;
          limit?: number;
        };
        try {
          const interval = parseInterval(p.interval);
          const result = resolveHistoryBars({
            symbol: p.symbol,
            interval,
            mode: 'range',
            from: p.from,
            to: p.to,
            limit: p.limit ?? 5000,
          });
          send(ws, {
            v: '1.0',
            id: replyId,
            type: 'history.response',
            payload: { bars: result.bars, hasMore: result.hasMore },
          });
        } catch {
          send(ws, {
            v: '1.0',
            id: replyId,
            type: 'error',
            payload: { code: 'INVALID_RANGE', message: 'Invalid history range' },
          });
        }
        return;
      }
    });

    ws.on('close', () => {
      const clientSubs = subs.get(ws);
      if (clientSubs) {
        for (const sub of clientSubs.values()) {
          if (sub.timer) clearInterval(sub.timer);
        }
      }
      subs.delete(ws);
    });
  });

  return wss;
}

function startBarPush(ws: WebSocket, sub: Subscription) {
  if (sub.timer) clearInterval(sub.timer);

  let seq = 1n;
  let openTime = floorBarOpenTime(Date.now(), sub.interval);
  let bar = generateBars({
    symbol: sub.symbol,
    interval: sub.interval,
    endTime: openTime,
    count: 1,
  })[0]!;

  sub.timer = setInterval(() => {
    if (ws.readyState !== ws.OPEN) return;

    const now = Date.now();
    const currentOpen = floorBarOpenTime(now, sub.interval);

    if (currentOpen > openTime) {
      send(ws, {
        v: '1.0',
        type: 'bar',
        payload: {
          subscriptionId: sub.id,
          bar,
          partial: false,
          barSeq: String(seq++),
        },
      });
      openTime = currentOpen;
      bar = seedNextBar(sub.symbol, sub.interval, openTime, bar.c);
    } else {
      const jitter = (Math.random() - 0.5) * (bar.c * 0.00015);
      const c = bar.c + jitter;
      bar = {
        ...bar,
        h: Math.max(bar.h, c + Math.abs(jitter)),
        l: Math.min(bar.l, c - Math.abs(jitter)),
        c,
      };
      send(ws, {
        v: '1.0',
        type: 'bar',
        payload: {
          subscriptionId: sub.id,
          bar,
          partial: true,
          barSeq: String(seq++),
        },
      });
    }
  }, 1000);
}