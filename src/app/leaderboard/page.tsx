'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getLeaderboard } from '@/lib/supabase';
import { usePlayerStore } from '@/stores/playerStore';
import type { GameMode } from '@/types';

type TabMode = GameMode;

interface LeaderEntry {
  id: string;
  score: number;
  max_combo: number;
  players: { id: string; nickname: string } | null;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const playerId = usePlayerStore((s) => s.playerId);
  const [tab, setTab] = useState<TabMode>('single');
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(tab)
      .then((data) => setRows((data as unknown as LeaderEntry[]) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const tabLabel: Record<TabMode, string> = {
    single: '싱글',
    coop: '협력',
    versus: '대전',
  };

  const rankClass = (i: number) =>
    i === 0 ? 'leaderboard-row--top1' :
    i === 1 ? 'leaderboard-row--top2' :
    i === 2 ? 'leaderboard-row--top3' : '';

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <button className="btn btn--ghost" onClick={() => router.push('/')} style={{ fontSize: 'inherit' }}>
          ← 뒤로
        </button>
        <h1>LEADERBOARD</h1>
      </div>

      <div className="leaderboard-tabs">
        {(['single', 'coop', 'versus'] as TabMode[]).map((t) => (
          <button
            key={t}
            className={`leaderboard-tab${tab === t ? ' leaderboard-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {tabLabel[t]}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ fontFamily: 'Mulmaru', color: '#7a7a9a', textAlign: 'center', marginTop: '32px' }}>
          로딩 중...
        </p>
      )}

      {!loading && (
        <div className="leaderboard-table">
          {rows.length === 0 && (
            <p style={{ fontFamily: 'Mulmaru', color: '#7a7a9a', textAlign: 'center', marginTop: '32px' }}>
              기록이 없습니다
            </p>
          )}
          {rows.map((row, i) => {
            const isMine = playerId && row.players?.id === playerId;
            return (
              <div
                key={row.id}
                className={[
                  'leaderboard-row',
                  rankClass(i),
                  isMine ? 'leaderboard-row--mine' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="leaderboard-rank">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </span>
                <span>{row.players?.nickname ?? '알 수 없음'}</span>
                <span>{row.score.toLocaleString()}점</span>
                <span>{row.max_combo}x</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
