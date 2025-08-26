import type { Side } from '@pb/shared';

export type Effect =
  | {
      id: number;
      kind: 'burst';
      x: number;
      y: number;
      side: Side;
      t0: number;
      ttl: number;
      crit?: boolean;
    }
  | {
      id: number;
      kind: 'floater';
      x: number;
      y: number;
      side: Side;
      t0: number;
      ttl: number;
      text: string;
      color?: string;
    };

let __eid = 1;
export const makeHitBurst = (
  x: number,
  y: number,
  side: Side,
  now: number,
  crit = false
): Effect => ({ id: __eid++, kind: 'burst', x, y, side, t0: now, ttl: crit ? 520 : 350, crit });
export const makeFloater = (
  text: string,
  x: number,
  y: number,
  side: Side,
  now: number,
  color?: string
): Effect => ({ id: __eid++, kind: 'floater', x, y, side, t0: now, ttl: 700, text, color });

export function renderAndPruneEffects(
  ctx: CanvasRenderingContext2D,
  effects: Effect[],
  now: number
) {
  const keep: Effect[] = [];
  for (const e of effects) {
    const age = now - e.t0;
    if (age < 0 || age > e.ttl) continue;
    const t = age / e.ttl;

    if (e.kind === 'burst') {
      const base = e.side === 'A' ? '#3b82f6' : '#ef4444';
      const hue = e.crit ? '#fde047' : base;
      ctx.save();
      ctx.globalAlpha = (e.crit ? 0.75 : 0.6) * (1 - t);
      ctx.strokeStyle = hue;
      ctx.lineWidth = 1 + (e.crit ? 3 : 2) * t;
      const r = 8 + (e.crit ? 52 : 36) * t;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = (e.crit ? 0.5 : 0.35) * (1 - t);
      const rays = e.crit ? 10 : 6;
      for (let i = 0; i < rays; i++) {
        const ang = (i / rays) * Math.PI * 2 + t * 5;
        const len = (e.crit ? 14 : 10) + (e.crit ? 28 : 20) * t;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ang) * (r - 4), e.y + Math.sin(ang) * (r - 4));
        ctx.lineTo(e.x + Math.cos(ang) * (r - 4 + len), e.y + Math.sin(ang) * (r - 4 + len));
        ctx.stroke();
      }
      ctx.restore();
    } else {
      const up = 24 + 16 * t,
        alpha = 1 - t;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0b0f1a';
      ctx.fillStyle = e.color || (e.side === 'A' ? '#93c5fd' : '#fca5a5');
      ctx.strokeText(e.text, e.x, e.y - up);
      ctx.fillText(e.text, e.x, e.y - up);
      ctx.restore();
    }
    keep.push(e);
  }
  effects.length = 0;
  effects.push(...keep);
}
