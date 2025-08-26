// 仅用于弓箭手的箭矢与命中火花（不改变伤害结算）
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
  dur: number; // ms
};

export type Impact = { x: number; y: number; t0: number; ttl: number; side: 'A' | 'B' };

let nextArrowId = 1;

export function makeArrow(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  side: 'A' | 'B',
  now: number,
  dur = 320
): Arrow {
  return { id: nextArrowId++, side, x0, y0, x1, y1, t0: now, dur };
}

// 在射程内找最近敌军；若无则塔
export function findArcherTarget(s: GameState, q: Squad): { x: number; y: number } | null {
  const def = UNIT[q.type];
  const maxDist = def.rng * CONFIG.RANGE_PX_UNIT;
  let best: { e: Squad; d: number } | null = null;
  for (const e of s.squads) {
    if (e.side === q.side) continue;
    const d = Math.abs(e.x - q.x);
    if (d <= maxDist && (!best || d < best.d)) best = { e, d };
  }
  if (best) return { x: best.e.x, y: best.e.y };
  const enemyX = q.side === 'A' ? s.width - 40 : 40;
  const dBase = Math.abs(enemyX - q.x);
  if (dBase <= maxDist) return { x: enemyX, y: s.height / 2 - 10 };
  return null;
}

// —— 抛物线位置 & 朝向 —— //
function parabolaPos(x0: number, y0: number, x1: number, y1: number, k: number) {
  const arc = Math.min(18, Math.max(10, Math.abs(x1 - x0) * 0.08));
  // 线性插值
  const x = x0 + (x1 - x0) * k;
  const yLin = y0 + (y1 - y0) * k;
  // 顶点在中点的简单抛物：peak = arc * (1 - (2k-1)^2)
  const y = yLin - arc * (1 - (2 * k - 1) * (2 * k - 1));
  return { x, y };
}

function parabolaAngle(x0: number, y0: number, x1: number, y1: number, k: number) {
  const arc = Math.min(18, Math.max(10, Math.abs(x1 - x0) * 0.08));

  const dx = x1 - x0;
  const dy = y1 - y0 - arc * (-8 * k + 4); // 导数：d/dk [ -arc*(1-(2k-1)^2) ] / dk
  return Math.atan2(dy, dx);
}

// —— 用 SVG 精灵表绘制 —— //
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
  const fps = 14; // 箭矢更灵动
  const fi = Math.floor((now / 1000) * fps) % frames;
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
  if (!img) {
    // 回退：十字
    const k = Math.min(1, (now - t0) / 200);
    const a = 1 - k,
      r = 8 * (1 - k * 0.3);
    ctx.save();
    ctx.globalAlpha = 0.6 * a;
    ctx.strokeStyle = side === 'A' ? '#e5f0ff' : '#ffe5e5';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - r, y);
    ctx.lineTo(x + r, y);
    ctx.moveTo(x, y - r * 0.6);
    ctx.lineTo(x, y + r * 0.6);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const frames = 4,
    fw = Math.floor(img.width / frames),
    fh = img.height;
  const elapsed = now - t0,
    dur = 220;
  const fi = Math.min(frames - 1, Math.floor((elapsed / dur) * frames));
  const scale = 1.1,
    dw = fw * scale,
    dh = fh * scale;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fi * fw, 0, fw, fh, x - dw / 2, y - dh / 2, dw, dh);
  ctx.restore();
}

export function drawArrows(
  ctx: CanvasRenderingContext2D,
  arrows: Arrow[],
  impacts: Impact[],
  now: number,
  art?: Art
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // 先画拖影（3 个幽灵）
  for (const a of arrows) {
    if (!art?.arrowA || !art?.arrowB) break;
    for (let g = 1; g <= 3; g++) {
      const kg = Math.max(0, Math.min(1, (now - a.t0) / a.dur - g * 0.08));
      const { x, y } = parabolaPos(a.x0, a.y0, a.x1, a.y1, kg);
      const ang = parabolaAngle(a.x0, a.y0, a.x1, a.y1, kg);
      ctx.globalAlpha = [0.28, 0.18, 0.1][g - 1];
      drawArrowSprite(ctx, art, a.side, x, y, ang, now - g * 30);
    }
    ctx.globalAlpha = 1;
  }

  // 主箭体
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    const k = Math.min(1, (now - a.t0) / a.dur);
    const { x, y } = parabolaPos(a.x0, a.y0, a.x1, a.y1, k);
    const ang = parabolaAngle(a.x0, a.y0, a.x1, a.y1, k);

    if (art?.arrowA && art?.arrowB) {
      drawArrowSprite(ctx, art, a.side, x, y, ang, now);
    } else {
      // 回退：简单线条
      ctx.strokeStyle = a.side === 'A' ? '#93c5fd' : '#fca5a5';
      ctx.beginPath();
      ctx.moveTo(a.x0, a.y0);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

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
    drawImpactSprite(ctx, art!, p.side, p.x, p.y, now, p.t0);
  }

  ctx.restore();
}
