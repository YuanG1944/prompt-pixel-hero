import { useEffect, useRef, useState } from 'react';
import type { GameState, Side } from '@pb/shared';
import { CONFIG } from '@pb/shared';
import { useArt } from './hooks/useArt';
import { useGameSocket } from './hooks/useGameSocket';
import WavePanel from './components/WavePanel';
import RightPanel from './components/RightPanel';
import {
  drawAttackOverlay,
  drawBigHealthBars,
  drawField,
  drawSquad,
  drawVictoryOverlay,
} from './canvas/renderer';
import { Effect, makeFloater, makeHitBurst, renderAndPruneEffects } from './canvas/effects';
import {
  Arrow,
  drawArrows,
  findArcherTarget,
  getAimPoint,
  getBowMuzzle,
  Impact,
  makeArrow,
} from './canvas/projectiles';

export default function Playground({
  mode,
  side,
  wsUrl,
}: {
  mode: 'live' | 'client';
  side?: Side;
  wsUrl?: string;
}) {
  const cvs = useRef<HTMLCanvasElement>(null);
  const art = useArt();

  // 命中闪烁 & 震屏 & 滞后血条 & 特效
  const hitAt = useRef<Map<number, number>>(new Map());
  const effectsRef = useRef<Effect[]>([]);
  const shakeRef = useRef<{ until: number; amp: number }>({ until: 0, amp: 0 });
  const delayedHPRef = useRef<{ A: number; B: number }>({ A: CONFIG.BASE_HP, B: CONFIG.BASE_HP });

  // 胜利结算（Canvas 卡片按钮命中框）
  const [winner, setWinner] = useState<Side | null>(null);
  const victoryBtnRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const archerNextShotRef = useRef<Map<number, number>>(new Map()); // squadId -> next time
  const arrowsRef = useRef<Arrow[]>([]);
  const impactsRef = useRef<Impact[]>([]);

  function spawnArrowsIfNeeded(s: GameState, now: number) {
    const nextShot = archerNextShotRef.current;

    for (const q of s.squads) {
      if (q.type !== 'archer' || q.count <= 0) continue;

      const t = findArcherTarget(s, q);
      if (!t) continue;

      const FIRE_INTERVAL = 600;
      const due = nextShot.get(q.id) ?? 0;
      if (now < due) continue;

      const arrowsToSpawn = Math.max(1, Math.min(3, Math.ceil(q.count / 8)));
      const muzzle = getBowMuzzle(q);
      const aim = getAimPoint(t);

      for (let i = 0; i < arrowsToSpawn; i++) {
        // 轻微抖动，让多箭不完全重合
        const startX = muzzle.x + (Math.random() - 0.5) * 2;
        const startY = muzzle.y + (Math.random() - 0.5) * 2;
        const endX = aim.x + (Math.random() - 0.5) * 4;
        const endY = aim.y + (Math.random() - 0.5) * 3;

        const dx = Math.abs(endX - startX);
        const dur = Math.max(240, Math.min(420, 220 + dx * 0.25)); // 远处飞得久些
        const arc = Math.min(26, Math.max(12, 8 + dx * 0.07)); // 远处弧更高

        arrowsRef.current.push(makeArrow(startX, startY, endX, endY, q.side, now, dur, arc));
      }

      nextShot.set(q.id, now + FIRE_INTERVAL);
    }

    // 清理无效小队
    const alive = new Set(s.squads.map(q => q.id));
    for (const id of Array.from(nextShot.keys())) if (!alive.has(id)) nextShot.delete(id);
  }

  const { gsRef, money, log, tick, sendText, quickRecruit, reset } = useGameSocket(
    mode,
    side,
    wsUrl,
    // ★ 统一在回调里：只在“客户端且己方受击”时震屏；live 不震
    ({ state, unitHits, baseHits, now }) => {
      // 单位受击：加特效 +（仅客户端己方）轻微震屏
      for (const uh of unitHits) {
        const crit = uh.dmg > uh.q.hpEach * 1.2;
        hitAt.current.set(uh.q.id, now);
        effectsRef.current.push(makeHitBurst(uh.q.x, uh.q.y, uh.q.side, now, crit));
        effectsRef.current.push(
          makeFloater(`-${Math.round(uh.dmg)}`, uh.q.x, uh.q.y - 22, uh.q.side, now)
        );
        if (mode === 'client' && side && uh.q.side === side) {
          const amp = Math.min(8, 2 + uh.dmg / 40);
          shakeRef.current = { until: now + 180, amp };
        }
      }

      // 基地受击：加飘字 +（仅客户端己方）更强震屏
      if (baseHits.A) {
        effectsRef.current.push(
          makeFloater(`-${Math.round(baseHits.A)}`, 40, state.height / 2 - 60, 'A', now, '#93c5fd')
        );
        if (mode === 'client' && side === 'A') {
          shakeRef.current = { until: now + 450, amp: Math.min(12, 4 + baseHits.A / 60) };
        }
      }
      if (baseHits.B) {
        effectsRef.current.push(
          makeFloater(
            `-${Math.round(baseHits.B)}`,
            state.width - 40,
            state.height / 2 - 60,
            'B',
            now,
            '#fca5a5'
          )
        );
        if (mode === 'client' && side === 'B') {
          shakeRef.current = { until: now + 450, amp: Math.min(12, 4 + baseHits.B / 60) };
        }
      }
    }
  );

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const cv = cvs.current,
        s = gsRef.current;
      if (!cv || !s) {
        raf = requestAnimationFrame(loop);
        return;
      }
      const ctx = cv.getContext('2d')!;
      const now = Date.now();

      // 震屏（live 完全不震）
      let ox = 0,
        oy = 0;
      if (mode === 'client' && now < shakeRef.current.until) {
        const k = (shakeRef.current.until - now) / 450;
        ox = (Math.random() * 2 - 1) * shakeRef.current.amp * k;
        oy = (Math.random() * 2 - 1) * shakeRef.current.amp * k;
      }

      // 滞后黄条追赶
      const d = delayedHPRef.current;
      const step = (500 / 1000) * 200; // 500hp/s × 200ms
      d.A = d.A > s.bases.A.hp ? Math.max(s.bases.A.hp, d.A - step) : s.bases.A.hp;
      d.B = d.B > s.bases.B.hp ? Math.max(s.bases.B.hp, d.B - step) : s.bases.B.hp;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.translate(ox, oy);

      // 背景/塔/道路/暗角
      drawField(ctx, s, art || null, now);

      // ★ 生成弓手箭矢
      spawnArrowsIfNeeded(s, now);

      // 单位
      const HIT_MS = 220;
      (ctx as any).__state = s;

      for (const q of s.squads) {
        const isHit = !!(hitAt.current.get(q.id) && now - hitAt.current.get(q.id)! < HIT_MS);
        drawSquad(ctx, q, isHit, art || undefined, s);
      }

      // ★ 绘制箭矢与命中小火花
      drawArrows(ctx, arrowsRef.current, impactsRef.current, now, art || undefined);

      // 攻击覆盖层 + 特效
      drawAttackOverlay(ctx, s, now);
      renderAndPruneEffects(ctx, effectsRef.current, now);

      // 顶部大血条：固定不抖
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawBigHealthBars(ctx, s, d);

      // 胜负 → Canvas 白底卡片（并缓存按钮命中框）
      if (s.gameOver && s.winner) {
        if (!winner) setWinner(s.winner);
        const { button } = drawVictoryOverlay(ctx, s, s.winner, art || undefined);
        victoryBtnRef.current = button;
      } else {
        victoryBtnRef.current = null;
        if (winner) setWinner(null);
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [tick, art, mode, side, winner]);

  // Canvas 内点击“重新开始”（命中测试按钮区域）
  useEffect(() => {
    const cv = cvs.current;
    if (!cv) return;
    const onClick = (e: MouseEvent) => {
      if (!winner || !victoryBtnRef.current) return;
      const rect = cv.getBoundingClientRect();
      const scaleX = cv.width / rect.width;
      const scaleY = cv.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;
      const b = victoryBtnRef.current;
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
        // 重开
        reset();
        // 清理本地状态
        hitAt.current.clear();
        effectsRef.current = [];
        delayedHPRef.current = { A: CONFIG.BASE_HP, B: CONFIG.BASE_HP };
        arrowsRef.current = [];
        impactsRef.current = [];
        archerNextShotRef.current.clear();
        shakeRef.current = { until: 0, amp: 0 };
        victoryBtnRef.current = null;
        setWinner(null);
      }
    };
    cv.addEventListener('click', onClick);
    return () => cv.removeEventListener('click', onClick);
  }, [winner, reset]);

  const right =
    mode === 'client' ? (
      <RightPanel
        side={side!}
        money={money}
        log={log}
        onRecruit={(k, n) => quickRecruit(k, n)}
        onSend={t => sendText(t)}
      />
    ) : null;

  return (
    <div style={{ height: '100%', color: '#e5e7eb' }}>
      <div style={{ position: 'fixed', top: 10, left: 12, opacity: 0.7 }}>
        {mode === 'live' ? '直播：仅战场' : `当前玩家：${side === 'A' ? '甲（A）' : '乙（B）'}`}
      </div>
      <div style={{ position: 'fixed', top: 10, right: 20 }}>
        <button
          onClick={() => {
            reset();
            // 清理本地状态
            hitAt.current.clear();
            effectsRef.current = [];
            delayedHPRef.current = { A: CONFIG.BASE_HP, B: CONFIG.BASE_HP };
            arrowsRef.current = [];
            impactsRef.current = [];
            archerNextShotRef.current.clear();
            shakeRef.current = { until: 0, amp: 0 };
            victoryBtnRef.current = null;
            setWinner(null);
          }}
          style={{
            background: '#ef4444',
            border: 'none',
            color: '#fff',
            padding: '6px 10px',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          🔄 重新开始
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: right ? '1fr 320px' : '1fr',
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <canvas
            ref={cvs}
            width={CONFIG.WIDTH}
            height={CONFIG.HEIGHT}
            style={{ background: '#0b0f1a' }}
          />
          <WavePanel state={gsRef.current} />
        </div>
        {right}
      </div>
    </div>
  );
}
