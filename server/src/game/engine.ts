import { CONFIG, UNIT, UNIT_KEYS, GameState, Side, UnitKey, Squad } from '@pb/shared';

export function createEngine() {
  const S = { state: null as unknown as GameState };
  reset();

  function reset() {
    S.state = {
      width: CONFIG.WIDTH,
      height: CONFIG.HEIGHT,
      bases: {
        A: { hp: CONFIG.BASE_HP, money: CONFIG.START_MONEY }, // ✅
        B: { hp: CONFIG.BASE_HP, money: CONFIG.START_MONEY }, // ✅
      },
      squads: [],
      nextId: 1,
      batchA: 0,
      batchB: 0,
      lastSquadA: null,
      lastSquadB: null,
      winner: null,
      gameOver: false,
    };
  }

  function sanitize(): GameState {
    return S.state;
  }

  function spawn(
    side: Side,
    type: UnitKey,
    count: number,
    via: 'order' | 'auto' = 'order'
  ): Squad | null {
    const def = UNIT[type];
    if (!def || count <= 0) return null;
    const x = side === 'A' ? 80 : S.state.width - 80;
    const y = CONFIG.LANE_Y;
    const squad: Squad = {
      id: S.state.nextId++,
      side,
      type,
      count,
      hpEach: def.hp,
      totalHP: def.hp * count,
      x,
      y,
      batch: side === 'A' ? ++S.state.batchA : ++S.state.batchB,
      via,
    };
    const last = side === 'A' ? S.state.lastSquadA : S.state.lastSquadB;
    if (last && last.type === type) {
      last.count += count;
      last.totalHP += def.hp * count;
      return last;
    }
    S.state.squads.push(squad);
    // 如不再需要，lastSquadA/B 可清空或干脆删除这两个字段
    if (side === 'A') S.state.lastSquadA = null;
    else S.state.lastSquadB = null;
    return squad;
  }

  function tryRecruit(side: Side, orders: Partial<Record<UnitKey, number>>) {
    let cost = 0;
    for (const [k, n] of Object.entries(orders))
      cost += (UNIT[k as UnitKey]?.cost || 0) * (n as number);
    if (S.state.bases[side].money < cost)
      return { ok: false, reason: '余额不足', need: cost, has: S.state.bases[side].money };
    S.state.bases[side].money -= cost;
    for (const [k, n] of Object.entries(orders)) spawn(side, k as UnitKey, n as number, 'order');
    return { ok: true, cost };
  }

  function autoIncomeAndSpawn() {
    if (S.state.gameOver) return;
    (['A', 'B'] as Side[]).forEach(side => {
      S.state.bases[side].money += CONFIG.GOLD_PER_MIN;
      // const t = UNIT_KEYS[Math.floor(Math.random() * UNIT_KEYS.length)];
      // spawn(side, t, CONFIG.AUTO_SPAWN_COUNT, 'auto');
    });
  }

  function step(dt: number) {
    if (S.state.gameOver) return;
    S.state.squads = S.state.squads.filter(q => q.count > 0);

    // 移动
    for (const q of S.state.squads) {
      const def = UNIT[q.type];
      const dir = q.side === 'A' ? 1 : -1;

      let target: Squad | null = null;
      let best = Infinity;
      for (const e of S.state.squads) {
        if (e.side === q.side) continue;
        const d = Math.abs(e.x - q.x);
        if (d < best) {
          best = d;
          target = e;
        }
      }
      const inRange = target && best <= def.rng * CONFIG.RANGE_PX_UNIT;
      const enemyBaseX = q.side === 'A' ? S.state.width - 40 : 40;
      const baseDist = Math.abs(enemyBaseX - q.x);
      const enemyBaseInRange = baseDist <= def.rng * CONFIG.RANGE_PX_UNIT;

      if (!inRange && !(enemyBaseInRange && !target)) {
        q.x += dir * CONFIG.PX_PER_MS * dt;
        if (q.side === 'A') q.x = Math.min(q.x, S.state.width - 40);
        else q.x = Math.max(q.x, 40);
      }
    }

    // 结算
    const award: Record<Side, number> = { A: 0, B: 0 };
    for (const q of S.state.squads) {
      const def = UNIT[q.type];

      let target: Squad | null = null;
      let best = Infinity;
      for (const e of S.state.squads) {
        if (e.side === q.side) continue;
        const d = Math.abs(e.x - q.x);
        if (d < best) {
          best = d;
          target = e;
        }
      }
      const inRange = target && best <= def.rng * CONFIG.RANGE_PX_UNIT;

      if (inRange && target) {
        const raw = Math.max(def.atk - UNIT[target.type].def, 1);
        const dmg = raw * q.count * (dt / 1000);
        const beforeHP = target.totalHP;
        target.totalHP = Math.max(0, target.totalHP - dmg);
        const beforeCount = Math.ceil(beforeHP / target.hpEach);
        const afterCount = Math.ceil(target.totalHP / target.hpEach);
        const dead = Math.max(0, beforeCount - afterCount);
        if (dead > 0) award[q.side] += dead * 5;
        target.count = afterCount;
      } else {
        const enemy = q.side === 'A' ? ('B' as Side) : ('A' as Side);
        const enemyX = q.side === 'A' ? S.state.width - 40 : 40;
        const baseDist = Math.abs(enemyX - q.x);
        if (baseDist <= def.rng * CONFIG.RANGE_PX_UNIT) {
          const raw = Math.max(def.atk, 0);
          const dmg = raw * q.count * (dt / 1000);
          S.state.bases[enemy].hp = Math.max(0, S.state.bases[enemy].hp - dmg);
        }
      }
    }
    S.state.bases.A.money += award.A;
    S.state.bases.B.money += award.B;

    if (!S.state.gameOver) {
      if (S.state.bases.A.hp <= 0) {
        S.state.winner = 'B';
        S.state.gameOver = true;
      }
      if (S.state.bases.B.hp <= 0) {
        S.state.winner = 'A';
        S.state.gameOver = true;
      }
    }
  }

  return { state: S.state, reset, sanitize, spawn, tryRecruit, autoIncomeAndSpawn, step };
}
