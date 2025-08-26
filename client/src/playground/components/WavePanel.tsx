import { CONFIG, clamp01, maxHPForCurrentCount, UNIT } from '@pb/shared';
import type { GameState } from '@pb/shared';

export default function WavePanel({ state }: { state: GameState | null }) {
  if (!state) return null;
  const mk = (team: 'A' | 'B') =>
    state.squads
      .filter(q => q.side === team && q.count > 0)
      .sort((a, b) => a.batch - b.batch || a.id - b.id)
      .map(q => {
        const ratio = clamp01(q.totalHP / maxHPForCurrentCount(q.totalHP, q.hpEach));
        return {
          key: `${q.type}-${q.batch}-${q.id}`,
          label: `${UNIT[q.type].name} #${q.batch} ×${q.count}`,
          ratio,
        };
      });

  const left = mk('A'),
    right = mk('B');
  const Bar = ({ label, ratio, color }: { label: string; ratio: number; color: string }) => (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 2 }}>{label}</div>
      <div
        style={{
          position: 'relative',
          height: 8,
          background: '#0b1222',
          border: '1px solid #1f2937',
          borderRadius: 6,
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.round(ratio * 100)}%`,
            background: color,
            borderRadius: 6,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%,-50%)',
            fontSize: 10,
            color: '#e5e7eb',
            textShadow: '0 1px 2px rgba(0,0,0,.8)',
          }}
        >
          {Math.round(ratio * 100)}%
        </div>
      </div>
    </div>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        width: CONFIG.WIDTH,
        marginTop: 8,
      }}
    >
      <div>
        <div style={{ opacity: 0.7, marginBottom: 4 }}>A方 波次</div>
        <div style={{ height: 220, overflowY: 'auto', paddingRight: 6 }}>
          {left.map(it => (
            <Bar key={it.key} label={it.label} ratio={it.ratio} color='#3b82f6' />
          ))}
        </div>
      </div>
      <div>
        <div style={{ textAlign: 'right', opacity: 0.7, marginBottom: 4 }}>B方 波次</div>
        <div style={{ height: 220, overflowY: 'auto', paddingLeft: 6 }}>
          {right.map(it => (
            <Bar key={it.key} label={it.label} ratio={it.ratio} color='#ef4444' />
          ))}
        </div>
      </div>
    </div>
  );
}
