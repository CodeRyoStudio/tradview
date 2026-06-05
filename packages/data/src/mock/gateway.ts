import type { Server } from 'node:http';
import type { WebSocketServer } from 'ws';
import { attachMockWebSocket } from './ws-server.js';
import { createMockHttpServer, listenMockHttp } from './http-server.js';

export interface MockGateway {
  httpServer: Server;
  wss: WebSocketServer;
  restBaseUrl: string;
  wsUrl: string;
  close: () => Promise<void>;
}

export interface StartMockGatewayOptions {
  port?: number;
  host?: string;
}

export async function startMockGateway(opts: StartMockGatewayOptions = {}): Promise<MockGateway> {
  const host = opts.host ?? '127.0.0.1';
  const port = opts.port ?? 0;

  const httpServer = createMockHttpServer({ port, host });
  const wss = attachMockWebSocket(httpServer);

  const bind = (): Promise<void> =>
    new Promise((resolve, reject) => {
      const onError = (err: Error) => {
        httpServer.off('error', onError);
        wss.off('error', onError);
        reject(err);
      };
      httpServer.once('error', onError);
      wss.once('error', onError);
      void listenMockHttp(httpServer, port, host)
        .then(() => {
          httpServer.off('error', onError);
          wss.off('error', onError);
          resolve();
        })
        .catch(onError);
    });

  try {
    await bind();
  } catch (err) {
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
    throw err;
  }

  const address = httpServer.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind mock gateway');
  }

  const actualPort = address.port;
  const restBaseUrl = `http://${host}:${actualPort}`;
  const wsUrl = `ws://${host}:${actualPort}/ws?v=1.0`;

  return {
    httpServer,
    wss,
    restBaseUrl,
    wsUrl,
    close: () =>
      new Promise((resolve, reject) => {
        wss.close(() => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        });
      }),
  };
}