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
    | 'impactB',
    HTMLImageElement
  >
> & { ready: boolean };

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

  // ★ 对抗路加宽
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

  // ★ 塔放大
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

  // 低血量冒烟（保留）
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

// 判断近战是否攻击中（保持你现有逻辑，示意）
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

// ========= 改造 drawSquad：剑士用贴图，其它照旧 =========
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
      drawSprite(ctx, img, q, now, 1.9);
    }
  } else {
    // 其他兵种：原点阵
    const baseColor = q.side === 'A' ? '#60a5fa' : '#f87171';
    const color = isHit ? '#fbbf24' : baseColor;
    const auraR = Math.min(70, 18 + q.count * 0.6);
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = q.side === 'A' ? '#3b82f6' : '#ef4444';
    ctx.beginPath();
    ctx.arc(q.x, q.y, auraR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const dots = Math.min(q.count, 160),
      spread = Math.min(64, 10 + q.count * 0.45);
    for (let i = 0; i < dots; i++) {
      const jx = (Math.random() - 0.5) * spread,
        jy = (Math.random() - 0.5) * 22;
      ctx.fillStyle = color;
      if (q.side === 'A') ctx.fillRect(q.x + jx, q.y + jy, 2, 2);
      else {
        ctx.beginPath();
        ctx.arc(q.x + jx, q.y + jy, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
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

export function drawAttackOverlay(ctx: CanvasRenderingContext2D, s: GameState, now: number) {
  // function nearestEnemy(q: Squad) {
  //   let e: Squad | null = null,
  //     dmin = Infinity;
  //   for (const x of s.squads) {
  //     if (x.side === q.side) continue;
  //     const d = Math.abs(x.x - q.x);
  //     if (d < dmin) {
  //       dmin = d;
  //       e = x;
  //     }
  //   }
  //   return { e, dist: dmin };
  // }
  // for (const q of s.squads) {
  //   const def = UNIT[q.type];
  //   const { e, dist } = nearestEnemy(q);
  //   if (!e) continue;
  //   const inRange = dist <= def.rng * CONFIG.RANGE_PX_UNIT;
  //   if (!inRange) continue;
  //   const color = q.side === 'A' ? '#93c5fd' : '#fca5a5',
  //     midx = (q.x + e.x) / 2,
  //     midy = (q.y + e.y) / 2;
  //   if (def.rng >= 2) {
  //     ctx.save();
  //     ctx.strokeStyle = color;
  //     ctx.globalAlpha = 0.35;
  //     ctx.beginPath();
  //     ctx.moveTo(q.x, q.y);
  //     ctx.lineTo(e.x, e.y);
  //     ctx.stroke();
  //     for (let i = 0; i < 3; i++) {
  //       const ph = ((now * 0.004 + i * 0.33) % 1) as number;
  //       const x = q.x + (e.x - q.x) * ph,
  //         y = q.y + (e.y - q.y) * ph;
  //       ctx.globalAlpha = 0.7;
  //       ctx.fillStyle = color;
  //       ctx.beginPath();
  //       ctx.arc(x, y, 2, 0, Math.PI * 2);
  //       ctx.fill();
  //     }
  //     ctx.restore();
  //   } else {
  //     ctx.save();
  //     ctx.strokeStyle = color;
  //     ctx.globalAlpha = 0.5;
  //     ctx.lineWidth = 1.5;
  //     const jitter = (v: number) => v + (Math.random() - 0.5) * 8;
  //     for (let i = 0; i < 2; i++) {
  //       const dx = Math.sign(e.x - q.x);
  //       const x1 = jitter(midx - 6 * dx),
  //         y1 = jitter(midy - 8),
  //         x2 = jitter(midx + 6 * dx),
  //         y2 = jitter(midy + 8);
  //       ctx.beginPath();
  //       ctx.moveTo(x1, y1);
  //       ctx.lineTo(x2, y2);
  //       ctx.stroke();
  //     }
  //     ctx.restore();
  //   }
  // }
}

export function drawBigHealthBars(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  delayed: { A: number; B: number }
) {
  const margin = 16,
    gap = 120,
    h = 26,
    y = 12;
  const sideW = (s.width - margin * 2 - gap) / 2;
  const curA = clamp01(s.bases.A.hp / CONFIG.BASE_HP),
    curB = clamp01(s.bases.B.hp / CONFIG.BASE_HP);
  const delA = clamp01(delayed.A / CONFIG.BASE_HP),
    delB = clamp01(delayed.B / CONFIG.BASE_HP);

  ctx.fillStyle = '#0b1222';
  ctx.fillRect(margin, y, sideW, h);
  ctx.fillRect(s.width - margin - sideW, y, sideW, h);
  ctx.fillStyle = '#fde047';
  if (delA > curA) ctx.fillRect(margin + sideW * curA, y, sideW * (delA - curA), h);
  if (delB > curB) {
    const bw = sideW * (delB - curB);
    ctx.fillRect(s.width - margin - sideW * delB, y, bw, h);
  }
  ctx.fillStyle = '#3b82f6';
  ctx.fillRect(margin, y, sideW * curA, h);
  ctx.fillStyle = '#ef4444';
  const bw = sideW * curB;
  ctx.fillRect(s.width - margin - bw, y, bw, h);
  ctx.strokeStyle = '#111827';
  ctx.strokeRect(margin + 0.5, y + 0.5, sideW, h);
  ctx.strokeRect(s.width - margin - sideW + 0.5, y + 0.5, sideW, h);

  ctx.font = '16px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#e5e7eb';
  ctx.fillText('VS', s.width / 2, y + h / 2);

  const txtA = `${Math.max(0, Math.round(s.bases.A.hp))}/${CONFIG.BASE_HP} (${Math.round(
    curA * 100
  )}%)`;
  const txtB = `${Math.max(0, Math.round(s.bases.B.hp))}/${CONFIG.BASE_HP} (${Math.round(
    curB * 100
  )}%)`;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0b0f1a';
  ctx.fillStyle = '#e5e7eb';
  ctx.textAlign = 'left';
  ctx.strokeText(txtA, margin + 8, y + h / 2);
  ctx.fillText(txtA, margin + 8, y + h / 2);
  ctx.textAlign = 'right';
  ctx.strokeText(txtB, s.width - margin - 8, y + h / 2);
  ctx.fillText(txtB, s.width - margin - 8, y + h / 2);
}
