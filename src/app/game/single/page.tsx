'use client';

import { useEffect } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { useKeyboard } from '@/hooks/useKeyboard';
import { useGameLoop } from '@/hooks/useGameLoop';
import HpBar from '@/components/game/HpBar';
import OrderQueue from '@/components/game/OrderQueue';
import ScoreBoard from '@/components/game/ScoreBoard';
import InputPanel from '@/components/game/InputPanel';
import GameOverScreen from '@/components/game/GameOverScreen';

export default function SingleGamePage() {
  const status = useGameStore((s) => s.status);
  const hp = useGameStore((s) => s.hp);
  const score = useGameStore((s) => s.score);
  const combo = useGameStore((s) => s.combo);
  const orders = useGameStore((s) => s.orders);
  const currentBurger = useGameStore((s) => s.currentBurger);
  const startGame = useGameStore((s) => s.startGame);

  useEffect(() => {
    startGame('single');
  }, [startGame]);

  useGameLoop();
  useKeyboard({ enabled: status === 'playing' });

  return (
    <div className="ingame">
      <HpBar hp={hp} />
      <OrderQueue orders={orders} currentBurger={currentBurger} />
      <ScoreBoard score={score} combo={combo} />
      <InputPanel />
      {status === 'gameover' && <GameOverScreen />}
    </div>
  );
}
