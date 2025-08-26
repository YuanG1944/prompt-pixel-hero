import { useEffect, useState } from 'react';
import type { Art } from '../canvas/renderer';

const url = (p: string) => new URL(`../../assets/${p}`, import.meta.url).href;

const ASSETS = {
  grass: url('pixel/grass.svg'),
  road: url('pixel/road.svg'),
  towerA: url('pixel/tower_blue.svg'),
  towerB: url('pixel/tower_red.svg'),
  bgFar: url('pixel/bg_far.svg'),
  vignette: url('pixel/vignette.svg'),
  swordsmanWalkSvg: url('sprites/swordsman_walk.svg'),
  swordsmanAttackSvg: url('sprites/swordsman_attack.svg'),
  berserkerWalkSvg: url('sprites/berserker_walk.svg'),
  berserkerAttackSvg: url('sprites/berserker_attack.svg'),
  archerWalkSvg: url('sprites/archer_walk.svg'),
  archerAttackSvg: url('sprites/archer_attack.svg'),
  spearmanWalkSvg: url('sprites/spearman_walk.svg'),
  spearmanAttackSvg: url('sprites/spearman_attack.svg'),
  shieldWalkSvg: url('sprites/shield_walk.svg'),
  shieldAttackSvg: url('sprites/shield_attack.svg'),
  arrowSvg: url('sprites/arrow.svg'),
  impactSvg: url('sprites/impact_star.svg'),
} as const;

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Image load failed: ' + src));
    img.src = src;
  });
}
async function loadSvgText(src: string) {
  const r = await fetch(src);
  return await r.text();
}

// 两套配色（A=蓝，B=红）
const PAL_A = {
  C_OUTLINE: '#141823',
  C_CLOTH: '#3b82f6',
  C_LEATHER: '#66482a',
  C_PANTS: '#303c60',
  C_SKIN: '#e9c6a0',
  C_HAIR: '#28221c',
  C_METAL: '#d2d8e0',
  C_METAL_DK: '#8c96a0',
  C_WHITE: '#ffffff',
  C_SLASH: '#ffeab4',
  C_SLASH_CORE: '#ffffff',
  C_WOOD: '#8b5a2b', // ★ 新增
  // ★ 新增箭矢配色（蓝系）
  C_ARROW: '#93c5fd',
  C_ARROW_HI: '#e5f0ff',
};
const PAL_B = {
  ...PAL_A,
  C_CLOTH: '#ef4444', // ★ 箭矢改红系
  C_ARROW: '#fca5a5',
  C_ARROW_HI: '#ffe5e5',
};

// 将 SVG 文本按调色板替换为最终字符串
function tint(svg: string, pal: Record<string, string>) {
  return Object.keys(pal).reduce((acc, k) => acc.replaceAll(k, pal[k]), svg);
}
function svgToImage(svgText: string): Promise<HTMLImageElement> {
  const uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText);
  return loadImg(uri);
}

export function useArt() {
  const [art, setArt] = useState<Art | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // 位图/平铺类：直接加载
        const baseImgs = await Promise.all([
          loadImg(ASSETS.bgFar).catch(() => undefined),
          loadImg(ASSETS.grass).catch(() => undefined),
          loadImg(ASSETS.road).catch(() => undefined),
          loadImg(ASSETS.towerA).catch(() => undefined),
          loadImg(ASSETS.towerB).catch(() => undefined),
          loadImg(ASSETS.vignette).catch(() => undefined),
        ]);
        const [bgFar, grass, road, towerA, towerB, vignette] = baseImgs;

        // 读取原始 SVG 文本
        const [
          swordsmanWalkSvgRaw,
          swordsmanAttackSvgRaw,
          berserkerWalkSvgRaw,
          berserkerAttackSvgRaw,
          archerWalkSvgRaw,
          archerAttackSvgRaw,
          spearmanWalkSvgRaw,
          spearmanAttackSvgRaw,
          shieldWalkSvgRaw,
          shieldAttackSvgRaw,
          arrowSvgRaw,
          impactSvgRaw,
        ] = await Promise.all([
          loadSvgText(ASSETS.swordsmanWalkSvg),
          loadSvgText(ASSETS.swordsmanAttackSvg),

          loadSvgText(ASSETS.berserkerWalkSvg),
          loadSvgText(ASSETS.berserkerAttackSvg),

          loadSvgText(ASSETS.archerWalkSvg),
          loadSvgText(ASSETS.archerAttackSvg),

          loadSvgText(ASSETS.spearmanWalkSvg),
          loadSvgText(ASSETS.spearmanAttackSvg),

          loadSvgText(ASSETS.shieldWalkSvg),
          loadSvgText(ASSETS.shieldAttackSvg),

          loadSvgText(ASSETS.arrowSvg),
          loadSvgText(ASSETS.impactSvg),
        ]);

        // 生成 A/B 两套贴图（作为 Image 使用，帧裁切时当成 spritesheet）
        const [
          // 你已有的 swordsmanWalkA/B, swordsmanAttackA/B ...
          swoWalkA,
          swoWalkB,
          swoAtkA,
          swoAtkB,
          berWalkA,
          berWalkB,
          berAtkA,
          berAtkB,
          arcWalkA,
          arcWalkB,
          arcAtkA,
          arcAtkB,
          spWalkA,
          spWalkB,
          spAtkA,
          spAtkB,
          shWalkA,
          shWalkB,
          shAtkA,
          shAtkB,
          arrowA,
          arrowB,
          impactA,
          impactB,
        ] = await Promise.all([
          svgToImage(tint(swordsmanWalkSvgRaw, PAL_A)),
          svgToImage(tint(swordsmanWalkSvgRaw, PAL_B)),
          svgToImage(tint(swordsmanAttackSvgRaw, PAL_A)),
          svgToImage(tint(swordsmanAttackSvgRaw, PAL_B)),

          svgToImage(tint(berserkerWalkSvgRaw, PAL_A)),
          svgToImage(tint(berserkerWalkSvgRaw, PAL_B)),
          svgToImage(tint(berserkerAttackSvgRaw, PAL_A)),
          svgToImage(tint(berserkerAttackSvgRaw, PAL_B)),

          svgToImage(tint(archerWalkSvgRaw, PAL_A)),
          svgToImage(tint(archerWalkSvgRaw, PAL_B)),
          svgToImage(tint(archerAttackSvgRaw, PAL_A)),
          svgToImage(tint(archerAttackSvgRaw, PAL_B)),

          svgToImage(tint(spearmanWalkSvgRaw, PAL_A)),
          svgToImage(tint(spearmanWalkSvgRaw, PAL_B)),
          svgToImage(tint(spearmanAttackSvgRaw, PAL_A)),
          svgToImage(tint(spearmanAttackSvgRaw, PAL_B)),

          svgToImage(tint(shieldWalkSvgRaw, PAL_A)),
          svgToImage(tint(shieldWalkSvgRaw, PAL_B)),
          svgToImage(tint(shieldAttackSvgRaw, PAL_A)),
          svgToImage(tint(shieldAttackSvgRaw, PAL_B)),

          svgToImage(tint(arrowSvgRaw, PAL_A)),
          svgToImage(tint(arrowSvgRaw, PAL_B)),
          svgToImage(tint(impactSvgRaw, PAL_A)),
          svgToImage(tint(impactSvgRaw, PAL_B)),
        ]);

        const a: any = {
          ready: true,
          bgFar,
          grass,
          road,
          towerA,
          towerB,
          vignette,

          swordsmanWalkA: swoWalkA,
          swordsmanWalkB: swoWalkB,
          swordsmanAttackA: swoAtkA,
          swordsmanAttackB: swoAtkB,

          berserkerWalkA: berWalkA,
          berserkerWalkB: berWalkB,
          berserkerAttackA: berAtkA,
          berserkerAttackB: berAtkB,

          archerWalkA: arcWalkA,
          archerWalkB: arcWalkB,
          archerAttackA: arcAtkA,
          archerAttackB: arcAtkB,

          spearmanWalkA: spWalkA,
          spearmanWalkB: spWalkB,
          spearmanAttackA: spAtkA,
          spearmanAttackB: spAtkB,

          shieldWalkA: shWalkA,
          shieldWalkB: shWalkB,
          shieldAttackA: shAtkA,
          shieldAttackB: shAtkB,
        };
        if (mounted) setArt(a);
      } catch (e) {
        console.warn('[art] load failed', e);
        if (mounted) setArt({ ready: true });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  return art;
}
