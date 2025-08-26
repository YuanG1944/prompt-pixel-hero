// ===== 类型 =====
export type Side = 'A' | 'B';
export type UnitKey = 'swordsman' | 'archer' | 'berserker' | 'spearman' | 'shield';

export interface UnitStats {
  name: string;
  short: string;
  hp: number;
  atk: number;
  def: number;
  rng: number;
  cost: number;
}
export type UnitMap = Record<UnitKey, UnitStats>;

export interface BaseState {
  hp: number;
  money: number;
}
export interface Squad {
  id: number;
  side: Side;
  type: UnitKey;
  count: number;
  hpEach: number;
  totalHP: number;
  x: number;
  y: number;
  batch: number;
  via: 'order' | 'auto';
}
export interface GameState {
  width: number;
  height: number;
  bases: Record<Side, BaseState>;
  squads: Squad[];
  nextId: number;
  batchA: number;
  batchB: number;
  lastSquadA: Squad | null;
  lastSquadB: Squad | null;
  winner: Side | null;
  gameOver: boolean;
}

export const MSG = {
  HELLO: 'hello',
  JOIN: 'join',
  JOINED: 'joined',
  STATE: 'state',
  CHAT: 'chat',
  RECRUIT: 'recruit',
  RECRUIT_RESULT: 'recruitResult',
  RESET: 'reset',
  RESETED: 'reseted',
} as const;
export type MsgType = (typeof MSG)[keyof typeof MSG];

export const CONFIG = {
  WIDTH: 1200,
  HEIGHT: 420,
  BASE_HP: 2000,
  TICK_MS: 100,
  BROADCAST_MS: 200,
  GOLD_INTERVAL_MS: 60_000,
  GOLD_PER_MIN: 100,
  AUTO_SPAWN_COUNT: 0,
  PX_PER_MS: 0.06,
  RANGE_PX_UNIT: 28,
  LANE_Y: 420 / 2,
  START_MONEY: 1000,
} as const;

export const UNIT: UnitMap = {
  swordsman: { name: '剑士', short: '剑', hp: 100, atk: 5, def: 10, rng: 1, cost: 10 },
  archer: { name: '弓箭手', short: '弓', hp: 20, atk: 10, def: 1, rng: 5, cost: 15 },
  berserker: { name: '狂战士', short: '狂', hp: 150, atk: 20, def: 1, rng: 1, cost: 15 },
  spearman: { name: '长枪兵', short: '枪', hp: 100, atk: 5, def: 5, rng: 2, cost: 10 },
  shield: { name: '盾牌手', short: '盾', hp: 200, atk: 0, def: 20, rng: 1, cost: 15 },
};
export const UNIT_KEYS: UnitKey[] = ['swordsman', 'archer', 'berserker', 'spearman', 'shield'];

const NAME2KEY = new Map<string, UnitKey>([
  ['剑士', 'swordsman'],
  ['剑', 'swordsman'],
  ['弓箭手', 'archer'],
  ['弓手', 'archer'],
  ['弓', 'archer'],
  ['狂战士', 'berserker'],
  ['狂战', 'berserker'],
  ['狂', 'berserker'],
  ['长枪兵', 'spearman'],
  ['枪兵', 'spearman'],
  ['枪', 'spearman'],
  ['盾牌手', 'shield'],
  ['盾手', 'shield'],
  ['盾', 'shield'],
]);

export function parseChineseNumber(s: string | number): number {
  const str = String(s ?? '').trim();
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  const map: Record<string, number> = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  let rest = str;
  let total = 0;
  const hundred = rest.match(/(.*)百/);
  if (hundred) {
    const h = hundred[1] ? map[hundred[1]] ?? 1 : 1;
    total += h * 100;
    rest = rest.replace(/.*百/, '');
  }
  const ten = rest.match(/(.*)十/);
  if (ten) {
    const t = ten[1] ? map[ten[1]] ?? 1 : 1;
    total += t * 10;
    rest = rest.replace(/.*十/, '');
  }
  if (rest.length) total += map[rest] ?? 0;
  return total || 0;
}

export function parseOrders(text: string): Partial<Record<UnitKey, number>> {
  const orders: Partial<Record<UnitKey, number>> = {};
  const combo = String(text || '').replace(/[，,;；]/g, ' ');
  const regex =
    /(?:(\d+|[零一二两三四五六七八九十百]+)\s*个?)?\s*(剑士|剑|弓箭手|弓手|弓|狂战士|狂战|狂|长枪兵|枪兵|枪|盾牌手|盾手|盾)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(combo)) !== null) {
    const n = parseChineseNumber(m[1] || '1') || 1;
    const key = NAME2KEY.get(m[2]);
    if (key) orders[key] = (orders[key] || 0) + n;
  }
  return orders;
}

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const maxHPForCurrentCount = (totalHP: number, hpEach: number) =>
  Math.ceil(totalHP / hpEach) * hpEach;
