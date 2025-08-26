import { CONFIG, UNIT, clamp01, maxHPForCurrentCount } from '@pb/shared';
import type { GameState, Squad } from '@pb/shared';

// ★ 扩充 Art：加入剑士两张贴图
export type Art = Partial<
  Record<
    | 'grass'
    | 'road'
    | 'towerA'
    | 'towerB'
    | 'bgFar'
    | 'vignette'
    | 'swordsmanWalkA'
    | 'swordsmanWalkB'
    | 'swordsmanAttackA'
    | 'swordsmanAttackB'
    | 'berserkerWalkA'
    | 'berserkerWalkB'
    | 'berserkerAttackA'
    | 'berserkerAttackB'
    | 'archerWalkA'
    | 'archerWalkB'
    | 'archerAttackA'
    | 'archerAttackB'
    | 'spearmanWalkA'
    | 'spearmanWalkB'
    | 'spearmanAttackA'
    | 'spearmanAttackB'
    | 'shieldWalkA'
    | 'shieldWalkB'
    | 'shieldAttackA'
    | 'shieldAttackB'
    | 'arrowA'
    | 'arrowB'
    | 'impactA'
    | 'impactB'
    | 'trophyGoldSvg',
    HTMLImageElement
  >
> & { ready: boolean };

// 以 x=pivot 这条竖线为轴做水平镜像，然后执行 draw()
function mirrorXAbout(ctx: CanvasRenderingContext2D, pivotX: number, draw: () => void) {
  ctx.save();
  ctx.translate(pivotX, 0);
  ctx.scale(-1, 1);
  ctx.translate(-pivotX, 0);
  draw();
  ctx.restore();
}

function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  q: Squad,
  now: number,
  scale: number
) {
  const frames = 4,
    fw = Math.floor(img.width / frames),
    fh = img.height;
  const fps = 8;
  const fi = Math.floor((now / 1000) * fps) % frames;
  const dw = fw * scale,
    dh = fh * scale;
  ctx.save();
  if (q.side === 'B') {
    ctx.translate(q.x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-q.x, 0);
  }
  const dx = q.x - dw / 2,
    dy = q.y - dh * 0.78;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fi * fw, 0, fw, fh, dx, dy, dw, dh);
  ctx.restore();
}
function isAttacking(s: GameState, q: Squad) {
  const def = UNIT[q.type];
  let dmin = Infinity;
  for (const e of s.squads) {
    if (e.side === q.side) continue;
    dmin = Math.min(dmin, Math.abs(e.x - q.x));
  }
  if (dmin <= def.rng * CONFIG.RANGE_PX_UNIT) return true;
  const enemyX = q.side === 'A' ? s.width - 40 : 40;
  return Math.abs(enemyX - q.x) <= def.rng * CONFIG.RANGE_PX_UNIT;
}

// 其余 drawBigHealthBars 保持不变 …

export function drawField(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  art: Art | null,
  now: number
) {
  ctx.imageSmoothingEnabled = false;

  if (art?.bgFar) ctx.drawImage(art.bgFar, 0, 0, s.width, s.height);

  if (art?.grass) {
    const w = art.grass.width!,
      h = art.grass.height!;
    for (let y = 0; y < s.height; y += h)
      for (let x = 0; x < s.width; x += w) ctx.drawImage(art.grass, x, y);
  } else {
    ctx.fillStyle = 'rgba(59,130,246,0.06)';
    ctx.fillRect(0, 0, s.width / 2, s.height);
    ctx.fillStyle = 'rgba(239,68,68,0.06)';
    ctx.fillRect(s.width / 2, 0, s.width / 2, s.height);
  }

  const roadH = 110;
  const roadTop = s.height / 2 - roadH / 2;
  if (art?.road) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, roadTop, s.width, roadH);
    ctx.clip();
    const w = art.road.width!,
      h = art.road.height!;
    for (let y = Math.floor(roadTop / h) * h; y < roadTop + roadH; y += h)
      for (let x = 0; x < s.width; x += w) ctx.drawImage(art.road, x, y);
    ctx.restore();
  } else {
    ctx.fillStyle = '#1c253f';
    ctx.fillRect(0, roadTop, s.width, roadH);
  }

  const scaleTower = 1.35;
  let towerH = 100;
  if (art?.towerA && art?.towerB) {
    const taW = art.towerA.width!,
      taH = art.towerA.height!;
    const tbW = art.towerB.width!,
      tbH = art.towerB.height!;
    const daW = taW * scaleTower,
      daH = taH * scaleTower;
    const dbW = tbW * scaleTower,
      dbH = tbH * scaleTower;
    towerH = Math.max(daH, dbH);
    ctx.drawImage(art.towerA, 20, s.height / 2 - daH / 2, daW, daH);
    ctx.drawImage(art.towerB, s.width - 20 - dbW, s.height / 2 - dbH / 2, dbW, dbH);
  } else {
    ctx.fillStyle = '#1e3a8a';
    ctx.fillRect(20, s.height / 2 - 70, 56, 140); // 放大降级版
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.ellipse(s.width - 60, s.height / 2, 34, 70, 0, 0, Math.PI * 2);
    ctx.fill();
    towerH = 140;
  }

  const smoke = (cx: number, cy: number) => {
    for (let i = 0; i < 4; i++) {
      const t = ((now * 0.001 + i * 0.37) % 1) as number;
      const x = cx + Math.sin((i + 1) * 2 + now * 0.002) * 6;
      const y = cy - 20 - t * 40;
      const r = 6 + 10 * t;
      ctx.save();
      ctx.globalAlpha = 0.25 * (1 - t);
      ctx.fillStyle = '#9ca3afb3';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };
  if (s.bases.A.hp / CONFIG.BASE_HP < 0.3) smoke(40, s.height / 2 - towerH / 2);
  if (s.bases.B.hp / CONFIG.BASE_HP < 0.3) smoke(s.width - 40, s.height / 2 - towerH / 2);

  if (art?.vignette) ctx.drawImage(art.vignette, 0, 0, s.width, s.height);
}

function isMeleeAttacking(s: GameState, q: Squad) {
  const def = UNIT[q.type];
  let dmin = Infinity;
  for (const e of s.squads) {
    if (e.side === q.side) continue;
    dmin = Math.min(dmin, Math.abs(e.x - q.x));
  }
  if (dmin <= def.rng * CONFIG.RANGE_PX_UNIT) return true;
  const enemyX = q.side === 'A' ? s.width - 40 : 40;
  return Math.abs(enemyX - q.x) <= def.rng * CONFIG.RANGE_PX_UNIT;
}

function drawSwordsmanSpriteSVG(
  ctx: CanvasRenderingContext2D,
  q: Squad,
  art: Art,
  now: number,
  s: GameState
) {
  const attacking = isMeleeAttacking(s, q);
  const img =
    q.side === 'A'
      ? attacking
        ? art.swordsmanAttackA
        : art.swordsmanWalkA
      : attacking
      ? art.swordsmanAttackB
      : art.swordsmanWalkB;
  if (!img) return;

  const frames = 4,
    fw = Math.floor(img.width / frames),
    fh = img.height;
  const fps = attacking ? 6 : 8;
  const fi = Math.floor((now / 1000) * fps) % frames;

  const scale = 1.85,
    dw = fw * scale,
    dh = fh * scale;

  ctx.save();
  if (q.side === 'B') {
    ctx.translate(q.x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-q.x, 0);
  }

  const dx = q.x - dw / 2,
    dy = q.y - dh * 0.78;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, fi * fw, 0, fw, fh, dx, dy, dw, dh);
  ctx.restore();
}

export function drawSquad(
  ctx: CanvasRenderingContext2D,
  q: Squad,
  isHit: boolean,
  art?: Art,
  s?: GameState
) {
  const now = performance.now();

  if (art && s) {
    const atk = isAttacking(s, q);
    const pick = (a?: HTMLImageElement, b?: HTMLImageElement) => (q.side === 'A' ? a : b);

    if (q.type === 'swordsman' && art.swordsmanWalkA && art.swordsmanWalkB) {
      const img = atk
        ? pick(art.swordsmanAttackA, art.swordsmanAttackB)!
        : pick(art.swordsmanWalkA, art.swordsmanWalkB)!;
      drawSprite(ctx, img, q, now, 1.85);
    } else if (q.type === 'berserker' && art.berserkerWalkA && art.berserkerWalkB) {
      const img = atk
        ? pick(art.berserkerAttackA, art.berserkerAttackB)!
        : pick(art.berserkerWalkA, art.berserkerWalkB)!;
      drawSprite(ctx, img, q, now, 2.0);
    } else if (q.type === 'archer' && art.archerWalkA && art.archerWalkB) {
      const img = atk
        ? pick(art.archerAttackA, art.archerAttackB)!
        : pick(art.archerWalkA, art.archerWalkB)!;
      drawSprite(ctx, img, q, now, 1.8);
    } else if (q.type === 'spearman' && art.spearmanWalkA && art.spearmanWalkB) {
      const img = atk
        ? pick(art.spearmanAttackA, art.spearmanAttackB)!
        : pick(art.spearmanWalkA, art.spearmanWalkB)!;
      drawSprite(ctx, img, q, now, 1.85);
    } else if (q.type === 'shield' && art.shieldWalkA && art.shieldWalkB) {
      // 盾牌“攻击”帧表示举盾（贴身或进塔范围时）
      const img = atk
        ? pick(art.shieldAttackA, art.shieldAttackB)!
        : pick(art.shieldWalkA, art.shieldWalkB)!;

      // 当前盾兵朝向反了：统一在这里左右翻转一次
      mirrorXAbout(ctx, q.x, () => {
        drawSprite(ctx, img, q, now, 1.9);
      });
    }
  }

  // —— 兵牌/批次/血条（保持你现有逻辑）——
  const badgeTop = q.side === 'A' ? q.y - 68 : q.y + 4,
    textY = badgeTop + 12,
    barY = q.side === 'A' ? q.y - 60 : q.y + 10;
  // ctx.fillStyle = isHit ? '#f59e0baa' : '#000000aa';
  // ctx.fillRect(q.x - 10, badgeTop, 20, 16);
  // ctx.strokeStyle = q.side === 'A' ? '#3b82f6' : '#ef4444';
  // ctx.strokeRect(q.x - 10 + 0.5, badgeTop + 0.5, 20, 16);
  // ctx.fillStyle = '#fff';
  // ctx.font = '12px monospace';
  // ctx.textAlign = 'center';
  // ctx.fillText(UNIT[q.type].short, q.x, textY);

  const bx = q.x - 35,
    by = badgeTop;
  ctx.fillStyle = '#0b1222cc';
  ctx.fillRect(bx, by, 18, 12);
  ctx.strokeStyle = '#1f2937';
  ctx.strokeRect(bx + 0.5, by + 0.5, 18, 12);
  ctx.fillStyle = '#cbd5e1';
  ctx.font = '10px monospace';
  ctx.fillText(String(q.batch), bx + 9, by + 10);

  const maxHP = maxHPForCurrentCount(q.totalHP, q.hpEach),
    ratio = clamp01(q.totalHP / maxHP);
  const w = 44,
    h = 4;
  ctx.fillStyle = '#0b1222';
  ctx.fillRect(q.x - w / 2, barY, w, h);
  ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#eab308' : '#ef4444';
  ctx.fillRect(q.x - w / 2, barY, w * ratio, h);
  const pct = `${Math.round(ratio * 100)}%`;
  ctx.font = '10px monospace';
  ctx.textAlign = 'center';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0f1a';
  ctx.fillStyle = '#e5e7eb';
  const ty = q.side === 'A' ? barY - 6 : barY + h + 8;
  ctx.strokeText(pct, q.x, ty);
  ctx.fillText(pct, q.x, ty);
}

// 小工具：圆角矩形
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawVictoryOverlay(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  winner: 'A' | 'B',
  art?: Art
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0); // 固定在屏幕，不随震屏
  ctx.imageSmoothingEnabled = false;

  // 面板尺寸（自适应）
  const panelW = Math.min(520, Math.max(420, s.width * 0.55));
  const panelH = 260;
  const x = (s.width - panelW) / 2;
  const y = (s.height - panelH) / 2;

  // 阴影 + 白底卡片
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;

  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, panelW, panelH, 16);
  ctx.fill();

  // 顶部色条
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = winner === 'A' ? '#3b82f6' : '#ef4444';
  roundRect(ctx, x, y, panelW, 10, 16);
  ctx.fill();

  // 标题
  ctx.fillStyle = '#0b1222';
  ctx.font = 'bold 28px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(winner === 'A' ? '蓝方胜利' : '红方胜利', x + panelW / 2, y + 28);

  // 副标题
  ctx.fillStyle = '#475569';
  ctx.font = '16px ui-sans-serif, system-ui';
  ctx.fillText(winner === 'A' ? 'Blue Wins' : 'Red Wins', x + panelW / 2, y + 62);

  // ★ 奖杯图标（替换原来的圆）
  const cx = x + panelW / 2,
    cy = y + 120;
  const img = art?.trophyGoldSvg;
  if (img) {
    const targetH = 64; // 显示高度
    const scale = targetH / img.height;
    const dw = img.width * scale,
      dh = img.height * scale;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  } else {
    // 兜底（没加载到图时）
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();
  }

  // 说明
  ctx.fillStyle = '#64748b';
  ctx.font = '14px ui-sans-serif, system-ui';
  ctx.fillText('点击下方按钮重新开始', x + panelW / 2, y + 160);

  // 按钮（返回其矩形给上层做点击检测）
  const btnW = 180,
    btnH = 44;
  const bx = x + (panelW - btnW) / 2;
  const by = y + panelH - 24 - btnH;

  // 按钮阴影
  ctx.shadowColor = 'rgba(0,0,0,0.18)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  // 按钮本体
  const btnColor = winner === 'A' ? '#3b82f6' : '#ef4444';
  ctx.fillStyle = btnColor;
  roundRect(ctx, bx, by, btnW, btnH, 10);
  ctx.fill();

  // 按钮文字
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 16px ui-sans-serif, system-ui';
  ctx.textBaseline = 'middle';
  ctx.fillText('重新开始', bx + btnW / 2, by + btnH / 2);

  ctx.restore();
  return { button: { x: bx, y: by, w: btnW, h: btnH } };
}

export function drawAttackOverlay(ctx: CanvasRenderingContext2D, s: GameState, now: number) {}

export function drawBigHealthBars(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  delayed: { A: number; B: number },
  opts?: { lerp?: number }
) {
  const W = s.width,
    pad = 20,
    H = 18;
  const curA = s.bases.A.hp,
    curB = s.bases.B.hp;
  const max = CONFIG.BASE_HP;

  // 滞后追赶（0.12~0.2 比较自然）
  const k = opts?.lerp ?? 0.16;
  delayed.A += (curA - delayed.A) * k;
  delayed.B += (curB - delayed.B) * k;

  const ratioA = clamp01(curA / max);
  const ratioB = clamp01(curB / max);
  const delayA = clamp01(delayed.A / max);
  const delayB = clamp01(delayed.B / max);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.font = '12px monospace';
  ctx.textBaseline = 'middle';

  // 背板
  ctx.fillStyle = '#0b1222dd';
  ctx.fillRect(pad, pad, W / 2 - pad * 1.5, H);
  ctx.fillRect(W / 2 + pad * 0.5, pad, W / 2 - pad * 1.5, H);

  // 黄条（滞后）
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(pad, pad, (W / 2 - pad * 1.5) * delayA, H);
  ctx.fillRect(W - pad - (W / 2 - pad * 1.5) * delayB, pad, (W / 2 - pad * 1.5) * delayB, H);

  // 真实血量（蓝/红）
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(pad, pad, (W / 2 - pad * 1.5) * ratioA, H);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(W - pad - (W / 2 - pad * 1.5) * ratioB, pad, (W / 2 - pad * 1.5) * ratioB, H);

  // 边框+数值
  ctx.strokeStyle = '#111827';
  ctx.strokeRect(pad + 0.5, pad + 0.5, W / 2 - pad * 1.5, H);
  ctx.strokeRect(W / 2 + pad * 0.5 + 0.5, pad + 0.5, W / 2 - pad * 1.5, H);

  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'left';
  ctx.fillText(`${Math.max(0, Math.round(curA))} / ${max}`, pad + 6, pad + H / 2);
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.max(0, Math.round(curB))} / ${max}`, W - pad - 6, pad + H / 2);

  ctx.restore();
}
