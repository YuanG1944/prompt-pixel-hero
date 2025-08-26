import { UNIT } from '@pb/shared';
import type { Side } from '@pb/shared';

export default function RightPanel({
  side,
  money,
  onRecruit,
  onSend,
  log,
}: {
  side: Side;
  money: number;
  onRecruit: (k: keyof typeof UNIT, n: number) => void;
  onSend: (text: string) => void;
  log: { t: string; cls: 'me' | 'other' | 'sys' }[];
}) {
  const order = ['swordsman', 'archer', 'berserker', 'spearman', 'shield'] as const;
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: '120px auto 1fr',
        borderLeft: '1px solid #1f2937',
        background: '#0e1423',
      }}
    >
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 18 }}>
          💰 钱币：<b>{money}</b>
        </div>
        <div style={{ opacity: 0.7, marginTop: 6 }}>每分钟 +100（不自动出兵）</div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        {order.map(k => {
          const u = UNIT[k];
          return (
            <div
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#0b1222',
                border: '1px solid #1f2937',
                borderRadius: 12,
                padding: '8px 10px',
                margin: '8px 0',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: side === 'A' ? '#3b82f6' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {u.short}
                </div>
                <div>{u.name}</div>
              </div>
              <div>
                HP:{u.hp} 攻:{u.atk} 防:{u.def} 距:{u.rng} 费:{u.cost}
              </div>
              <div>
                <button style={btn} onClick={() => onRecruit(k, 1)}>
                  +1
                </button>{' '}
                <button style={btn} onClick={() => onRecruit(k, 5)}>
                  +5
                </button>{' '}
                <button style={btn} onClick={() => onRecruit(k, 10)}>
                  +10
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            background: '#0b1222',
            border: '1px solid #1f2937',
            borderRadius: 12,
            padding: 10,
          }}
        >
          {log.map((l, i) => (
            <div
              key={i}
              style={{
                color: l.cls === 'sys' ? '#93c5fd' : l.cls === 'me' ? '#22d3ee' : '#c084fc',
              }}
            >
              {l.t}
            </div>
          ))}
        </div>
        <ChatInput onSend={onSend} />
        <div style={{ opacity: 0.7, marginTop: 6 }}>
          示例：招募 十 狂战、5盾；生成2枪3弓；出兵：二十剑士
        </div>
      </div>
    </div>
  );
}

function ChatInput({ onSend }: { onSend: (t: string) => void }) {
  const id = 'msg-box';
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
      <input
        id={id}
        placeholder='自然语言指挥：如『招募3个剑士和2个弓箭手』'
        style={{
          flex: 1,
          background: '#0b1222',
          border: '1px solid #1f2937',
          borderRadius: 8,
          padding: 10,
          color: '#e5e7eb',
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            const v = (e.target as HTMLInputElement).value.trim();
            if (v) onSend(v);
            (e.target as HTMLInputElement).value = '';
          }
        }}
      />
      <button
        style={btn}
        onClick={() => {
          const el = document.getElementById(id) as HTMLInputElement;
          const v = el?.value?.trim();
          if (v) {
            onSend(v);
            el.value = '';
          }
        }}
      >
        发送
      </button>
    </div>
  );
}
const btn: React.CSSProperties = {
  background: '#1f2937',
  color: '#e5e7eb',
  border: '1px solid #374151',
  padding: '6px 10px',
  borderRadius: 8,
  cursor: 'pointer',
};
