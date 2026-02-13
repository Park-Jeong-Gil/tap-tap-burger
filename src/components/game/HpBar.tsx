'use client';

import { HP_MAX } from '@/lib/constants';

interface HpBarProps {
  hp: number;
}

export default function HpBar({ hp }: HpBarProps) {
  const pct = Math.max(0, Math.min(100, (hp / HP_MAX) * 100));
  const cls =
    pct <= 25 ? 'hp-bar-fill--danger' :
    pct <= 50 ? 'hp-bar-fill--warning' : '';

  return (
    <div className="ingame__hp">
      <p className="hp-bar-label">HP {Math.ceil(hp)} / {HP_MAX}</p>
      <div className="hp-bar-wrap">
        <div
          className={`hp-bar-fill ${cls}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
