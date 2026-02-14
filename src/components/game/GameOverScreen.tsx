'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';

export default function GameOverScreen() {
  const router = useRouter();
  const score = useGameStore((s) => s.score);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const resetGame = useGameStore((s) => s.resetGame);
  const startGame = useGameStore((s) => s.startGame);
  const saveScore = useGameStore((s) => s.saveScore);
  const mode = useGameStore((s) => s.mode);
  const playerId = usePlayerStore((s) => s.playerId);
  const [isNewRecord, setIsNewRecord] = useState<boolean | null>(null);

  useEffect(() => {
    if (!playerId) return;
    saveScore(playerId).then((newRecord) => setIsNewRecord(newRecord));
  }, [playerId, saveScore]);

  const handleRestart = () => {
    startGame(mode);
  };

  const handleHome = () => {
    resetGame();
    router.push('/');
  };

  return (
    <div className="gameover-overlay">
      <h2 className="gameover-title">GAME OVER</h2>
      <div className="gameover-stats">
        <p>SCORE <span>{score.toLocaleString()}</span></p>
        <p>MAX COMBO <span>{maxCombo}x</span></p>
        {isNewRecord === true && <p style={{ color: '#2E9E3E', fontSize: '0.8em' }}>🏆 신기록 달성!</p>}
      </div>
      <div className="gameover-actions">
        {mode !== 'versus' && (
          <button className="btn btn--primary" onClick={handleRestart}>
            다시 시작
          </button>
        )}
        <button className="btn btn--ghost" onClick={handleHome}>
          메인으로
        </button>
      </div>
    </div>
  );
}
