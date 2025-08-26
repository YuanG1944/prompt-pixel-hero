import type { GameState, Squad } from '@pb/shared';
import { CONFIG, UNIT } from '@pb/shared';
import type { Art } from './renderer';

export type Arrow = {
  id: number;
  side: 'A' | 'B';
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t0: number;
  dur: number;
  arc: number; // ★ 抛物高度
};

export type Impact = { x: number; y: number; t0: number; ttl: number; side: 'A' | 'B' };

let nextArrowId = 1;

export type TargetPoint = { kind: 'squad' | 'base'; x: number; y: number; squad?: Squad };

// ---------- 坐标锚点：弓口 & 命中点 ----------
export const BOW_MUZZLE_X = 12; // 水平前探（随阵营取 +/−）
export const BOW_MUZZLE_Y = 16; // 脚底向上多少像素（弓口高度）

// 不同兵种命中在胸口/头部附近（可按需要微调）
export const HIT_OFFSETS: Partial<Record<Squad['type'], number>> = {
  swordsman: 18,
  berserker: 20,
  archer: 16,
  spearman: 18,
  shield: 18,
};

export function getBowMuzzle(q: Squad): { x: number; y: number } {
  const x = q.x + (q.side === 'A' ? +BOW_MUZZLE_X : -BOW_MUZZLE_X);
  const y = q.y - BOW_MUZZLE_Y;
  return { x, y };
}

export function getAimPoint(t: TargetPoint): { x: number; y: number } {
  if (t.kind === 'squad' && t.squad) {
    const off = HIT_OFFSETS[t.squad.type] ?? 16;
    return { x: t.x, y: t.y - off };
  }
  // base：findArcherTarget 已给了偏上 y
  return { x: t.x, y: t.y };
}

export function makeArrow(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  side: 'A' | 'B',
  now: number,
  dur: number,
  arc: number
): Arrow {
  return { id: nextArrowId++, side, x0, y0, x1, y1, t0: now, dur, arc };
}

// ---------- 射程内选最近敌军：返回 kind ----------
export function findArcherTarget(s: GameState, q: Squad): TargetPoint | null {
  const def = UNIT[q.type];
  const maxDist = def.rng * CONFIG.RANGE_PX_UNIT;

  let best: { e: Squad; d: number } | null = null;
  for (const e of s.squads) {
    if (e.side === q.side) continue;
    const d = Math.abs(e.x - q.x);
    if (d <= maxDist && (!best || d < best.d)) best = { e, d };
  }
  if (best) return { kind: 'squad', x: best.e.x, y: best.e.y, squad: best.e };

  // 打塔：取塔身偏上
  const enemyX = q.side === 'A' ? s.width - 40 : 40;
  const dBase = Math.abs(enemyX - q.x);
  if (dBase <= maxDist) {
    return { kind: 'base', x: enemyX, y: s.height / 2 - 24 }; // ← 适当高于中线
  }
  return null;
}

// 抛物线位置/角度
function parabolaPos(x0: number, y0: number, x1: number, y1: number, k: number, arc = 14) {
  const x = x0 + (x1 - x0) * k;
  const yLin = y0 + (y1 - y0) * k;
  const y = yLin - arc * (1 - (2 * k - 1) * (2 * k - 1));
  return { x, y };
}
function parabolaAngle(x0: number, y0: number, x1: number, y1: number, k: number, arc = 14) {
  const dx = x1 - x0;
  const dy = y1 - y0 + (8 * arc * k - 4 * arc); // d/dk 上式
  return Math.atan2(dy, dx);
}

// 用 SVG 精灵表绘制箭 & 命中星芒
function drawArrowSprite(
  ctx: CanvasRenderingContext2D,
  art: Art,
  side: 'A' | 'B',
  x: number,
  y: number,
  ang: number,
  now: number
) {
  const img = side === 'A' ? art.arrowA : art.arrowB;
  if (!img) return;
  const frames = 4,
    fw = Math.floor(img.width / frames),
    fh = img.height;
  const fi = Math.floor((now / 1000) * 14) % frames;
  const scale = 1.1,
    dw = fw * scale,
    dh = fh * scale;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fi * fw, 0, fw, fh, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}
function drawImpactSprite(
  ctx: CanvasRenderingContext2D,
  art: Art,
  side: 'A' | 'B',
  x: number,
  y: number,
  now: number,
  t0: number
) {
  const img = side === 'A' ? art.impactA : art.impactB;
  if (!img) return;
  const frames = 4,
    fw = Math.floor(img.width / frames),
    fh = img.height;
  const dur = 220,
    fi = Math.min(frames - 1, Math.floor(((now - t0) / dur) * frames));
  const scale = 1.1,
    dw = fw * scale,
    dh = fh * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fi * fw, 0, fw, fh, x - dw / 2, y - dh / 2, dw, dh);
  ctx.restore();
}

// ★ 主绘制：如没 art（或没箭图），不再画回退“直线”，直接跳过
export function drawArrows(
  ctx: CanvasRenderingContext2D,
  arrows: Arrow[],
  impacts: Impact[],
  now: number,
  art?: Art
) {
  if (!art?.arrowA || !art?.arrowB) return; // ← 防止回退成直线

  // 拖影（3 段幽灵）
  for (const a of arrows) {
    for (let g = 1; g <= 3; g++) {
      const kg = Math.max(0, Math.min(1, (now - a.t0) / a.dur - g * 0.08));
      const { x, y } = parabolaPos(a.x0, a.y0, a.x1, a.y1, kg, a.arc);
      const ang = parabolaAngle(a.x0, a.y0, a.x1, a.y1, kg, a.arc);
      ctx.globalAlpha = [0.28, 0.18, 0.1][g - 1];
      drawArrowSprite(ctx, art, a.side, x, y, ang, now - g * 30);
    }
    ctx.globalAlpha = 1;
  }

  // 主箭体
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    const k = Math.min(1, (now - a.t0) / a.dur);
    const { x, y } = parabolaPos(a.x0, a.y0, a.x1, a.y1, k, a.arc);
    const ang = parabolaAngle(a.x0, a.y0, a.x1, a.y1, k, a.arc);

    drawArrowSprite(ctx, art, a.side, x, y, ang, now);

    if (k >= 1) {
      impacts.push({ x, y, t0: now, ttl: 220, side: a.side });
      arrows.splice(i, 1);
    }
  }

  // 命中
  for (let i = impacts.length - 1; i >= 0; i--) {
    const p = impacts[i];
    const k = (now - p.t0) / p.ttl;
    if (k >= 1) {
      impacts.splice(i, 1);
      continue;
    }
    drawImpactSprite(ctx, art, p.side, p.x, p.y, now, p.t0);
  }
}
