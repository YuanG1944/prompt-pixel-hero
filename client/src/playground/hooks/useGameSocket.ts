import { useEffect, useMemo, useRef, useState } from 'react';
import { CONFIG, MSG } from '@pb/shared';
import type { GameState, Side, Squad } from '@pb/shared';

export type FrameDelta = {
  state: GameState;
  unitHits: { q: Squad; dmg: number }[];
  baseHits: { A?: number; B?: number };
  now: number;
};

// --- 地址规范化（避免 ws:<host> 少了 //） ---
function normalizeWs(input?: string): string {
  const def = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.hostname}:3001/game`;
  if (!input) return def;
  let raw = input.trim();
  if (raw.startsWith('http://')) raw = 'ws://' + raw.slice(7);
  if (raw.startsWith('https://')) raw = 'wss://' + raw.slice(8);
  if (raw.startsWith('ws:') && !raw.startsWith('ws://')) raw = 'ws://' + raw.slice(3);
  if (raw.startsWith('wss:') && !raw.startsWith('wss://')) raw = 'wss://' + raw.slice(4);
  if (!/^wss?:\/\//i.test(raw)) raw = 'ws://' + raw;
  const u = new URL(raw, location.origin);
  if (!/\/game($|\/|\?)/.test(u.pathname)) u.pathname = '/game';
  if (location.protocol === 'https:' && u.protocol !== 'wss:') u.protocol = 'wss:';
  return u.toString();
}

export function useGameSocket(
  mode: 'live' | 'client',
  side?: Side,
  wsUrl?: string,
  onFrame?: (d: FrameDelta) => void
) {
  const [money, setMoney] = useState(0);
  const [log, setLog] = useState<{ t: string; cls: 'me' | 'other' | 'sys' }[]>([]);
  const [tick, setTick] = useState(0);
  const [wsReady, setWsReady] = useState(false);

  const gsRef = useRef<GameState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // 🔒 连接控制
  const connectingRef = useRef(false);
  const connectTimerRef = useRef<number | null>(null);
  const closedRef = useRef(false);
  const backoffRef = useRef(500);

  // 📨 发送队列
  const queueRef = useRef<string[]>([]);

  // 📌 避免 onFrame 触发重连：用 ref 保存回调
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // ▲ 千万别把 onFrame 放进 useEffect 依赖里！
  const WS_URL = useMemo(() => {
    const candidate = wsUrl || (import.meta.env.VITE_WS_URL as string | undefined);
    const finalUrl = normalizeWs(candidate);
    console.info('[WS] connecting to:', finalUrl);
    return finalUrl;
  }, [wsUrl]);

  // 安全发送（OPEN直发，其他入队）
  const safeSend = (obj: unknown) => {
    const txt = JSON.stringify(obj);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(txt);
    else queueRef.current.push(txt);
  };

  // 计划重连（带抖动&单例）
  const scheduleReconnect = () => {
    if (closedRef.current) return;
    if (connectTimerRef.current != null) return;
    const b = Math.min(5000, backoffRef.current);
    const jitter = 1 + Math.random() * 0.2;
    const delay = Math.round(b * jitter);

    // 页面隐藏或离线 → 暂停重连，等恢复
    if (document.visibilityState === 'hidden' || !navigator.onLine) {
      const onResume = () => {
        window.removeEventListener('visibilitychange', onResume);
        window.removeEventListener('online', onResume);
        connect(); // 立即试一次
      };
      window.addEventListener('visibilitychange', onResume, { once: true });
      window.addEventListener('online', onResume, { once: true });
      return;
    }

    connectTimerRef.current = window.setTimeout(() => {
      connectTimerRef.current = null;
      connect();
    }, delay);
    backoffRef.current = Math.min(5000, b * 1.8);
  };

  const connect = () => {
    if (closedRef.current) return;
    if (connectingRef.current) return;
    if (wsRef.current) return; // 正在连着/未清理

    connectingRef.current = true;
    setWsReady(false);

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      connectingRef.current = false;
      backoffRef.current = 500;
      setWsReady(true);

      // 1) 先 JOIN
      if (mode === 'live') ws.send(JSON.stringify({ type: MSG.JOIN, role: 'viewer' }));
      else ws.send(JSON.stringify({ type: MSG.JOIN, role: 'client', side }));

      // 2) 再 flush 队列
      while (queueRef.current.length) {
        try {
          ws.send(queueRef.current.shift()!);
        } catch {}
      }
    };

    ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if ((m.type === MSG.HELLO || m.type === MSG.STATE || m.type === MSG.RESETED) && m.state) {
        const s: GameState = m.state;
        gsRef.current = s;
        if (mode === 'client' && side) setMoney(Math.floor(s.bases?.[side]?.money || 0));
        setTick(t => t + 1);

        // 计算帧增量（轻量）
        const now = Date.now();
        const unitHits: FrameDelta['unitHits'] = [];
        const baseHits: FrameDelta['baseHits'] = {};
        // 为了避免额外 Map，这里在 onFrame 里做更完整的命中比较也行
        // （如果你已经在外层做了 prevHP 比较，可以照旧）

        onFrameRef.current?.({ state: s, unitHits, baseHits, now });
      }

      if (m.type === MSG.RECRUIT_RESULT) {
        if (!m.res.ok)
          setLog(l => [
            ...l,
            { t: `❌ ${m.res.reason}（需${m.res.need}，有${m.res.has}）`, cls: 'sys' },
          ]);
        if (typeof m.money === 'number') setMoney(Math.floor(m.money));
      }
      if (m.type === MSG.CHAT) {
        const cls = m.from === side ? 'me' : 'other';
        const tag = m.from === side ? '我' : '对手';
        let extra = '';
        if (m.parsed && Object.keys(m.parsed).length)
          extra = m.result?.ok ? ` ✅ 扣费${m.result.cost}` : ` ❌ 余额不足`;
        setLog(l => [...l, { t: `${tag}：${m.text}${extra}`, cls }]);
      }
    };

    ws.onerror = () => {
      // 不在 onerror 里 close，交给 onclose 统一处理，避免重复回调导致并发重连
    };

    ws.onclose = () => {
      connectingRef.current = false;
      wsRef.current = null;
      setWsReady(false);
      scheduleReconnect();
    };
  };

  useEffect(() => {
    closedRef.current = false;
    connect(); // 首次连接
    return () => {
      closedRef.current = true;
      if (connectTimerRef.current != null) {
        clearTimeout(connectTimerRef.current);
        connectTimerRef.current = null;
      }
      try {
        wsRef.current?.close();
      } catch {}
      wsRef.current = null;
    };
    // 依赖只跟 URL / 模式 / 阵营有关，千万不要加 onFrame
  }, [WS_URL, mode, side]);

  // 对外方法（安全发送）
  const sendText = (text: string) => safeSend({ type: MSG.CHAT, text });
  const quickRecruit = (k: keyof typeof import('@pb/shared').UNIT, n: number) =>
    safeSend({ type: MSG.RECRUIT, orders: { [k]: n } });
  const reset = () => safeSend({ type: MSG.RESET });

  return { gsRef, money, log, tick, sendText, quickRecruit, reset, wsReady };
}
