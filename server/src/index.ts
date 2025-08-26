import express from 'express';
// import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG, UNIT, MSG, GameState, Side, parseOrders } from '@pb/shared';
import { createEngine } from './game/engine';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;
const WS_PATH = '/game';

const app = express();
// app.use(cors());
app.get('/health', (_req, res) => res.json({ ok: true }));

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// 仅接管 /game 的 WS，避免和 Vite HMR（:5173）串线
server.on('upgrade', (req, socket, head) => {
  if (req.url === WS_PATH) {
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

const engine = createEngine(); // 权威引擎

const send = (ws: WebSocket, obj: unknown) => {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
};
const broadcast = (obj: unknown) => {
  const s = JSON.stringify(obj);
  for (const c of wss.clients) if (c.readyState === WebSocket.OPEN) c.send(s);
};

// 定时器：步进/广播/自动收入
setInterval(() => engine.step(CONFIG.TICK_MS), CONFIG.TICK_MS);
setInterval(
  () => broadcast({ type: MSG.STATE, state: engine.sanitize(), unit: UNIT }),
  CONFIG.BROADCAST_MS
);
setInterval(() => engine.autoIncomeAndSpawn(), CONFIG.GOLD_INTERVAL_MS);

// 连接事件
wss.on('connection', ws => {
  (ws as any).role = 'viewer';
  (ws as any).side = null as Side | null;

  send(ws, {
    type: MSG.HELLO,
    unit: UNIT,
    state: engine.sanitize(),
    config: { width: CONFIG.WIDTH, height: CONFIG.HEIGHT, baseHP: CONFIG.BASE_HP },
  });

  ws.on('message', raw => {
    let msg: any = null;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === MSG.JOIN) {
      (ws as any).role = msg.role || 'viewer';
      (ws as any).side = (msg.side as Side) || null;
      send(ws, {
        type: MSG.JOINED,
        side: (ws as any).side,
        role: (ws as any).role,
        state: engine.sanitize(),
      });
    }

    if (msg.type === MSG.CHAT && (ws as any).role === 'client' && (ws as any).side) {
      const text = String(msg.text || '');
      const orders = parseOrders(text);
      let res = null as null | {
        ok: boolean;
        cost?: number;
        reason?: string;
        need?: number;
        has?: number;
      };
      if (Object.keys(orders).length) res = engine.tryRecruit((ws as any).side, orders);
      broadcast({
        type: MSG.CHAT,
        from: (ws as any).side,
        text,
        parsed: orders,
        result: res || { ok: null },
      });
    }

    if (msg.type === MSG.RECRUIT && (ws as any).role === 'client' && (ws as any).side) {
      const res = engine.tryRecruit((ws as any).side, msg.orders || {});
      send(ws, {
        type: MSG.RECRUIT_RESULT,
        res,
        money: engine.state.bases[(ws as any).side].money,
      });
    }

    if (msg.type === MSG.RESET) {
      engine.reset();
      broadcast({ type: MSG.RESETED, state: engine.sanitize() });
    }
  });
});

server.listen(PORT, () => {
  console.log(`> API: http://localhost:${PORT}`);
  console.log(`> WS : ws://localhost:${PORT}${WS_PATH}`);
});
