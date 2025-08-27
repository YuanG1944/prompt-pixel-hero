import { Link } from 'react-router-dom';
import logo from '../assets/ui/pixel_battle_logo.png';

export default function Home() {
  const Card = ({ to, title, desc }: { to: string; title: string; desc: string }) => (
    <Link
      to={to}
      style={{
        display: 'block',
        padding: '16px 18px',
        borderRadius: 12,
        background: '#0f172a',
        border: '1px solid #1f2937',
        color: '#e5e7eb',
        textDecoration: 'none',
        width: 260,
        boxShadow: '0 6px 16px rgba(0,0,0,0.25)',
      }}
      target='_blank'
    >
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>{desc}</div>
    </Link>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(180deg,#0b1222 0%,#0b0f1a 100%)',
        color: '#e5e7eb',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 80,
        }}
      >
        <div style={{ display: 'flex' }}>
          <img
            src={logo}
            alt='Pixel Battle'
            width={900}
            style={{
              borderRadius: 12,
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          <Card to='/live' title='Live' desc='战场（观众/直播页）' />
          <Card to='/client?side=A' title='Client A' desc='玩家甲（蓝阵营）' />
          <Card to='/client?side=B' title='Client B' desc='玩家乙（红阵营）' />
        </div>
      </main>
    </div>
  );
}
