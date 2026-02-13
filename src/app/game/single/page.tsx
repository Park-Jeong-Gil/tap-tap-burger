'use client';

import { useEffect, useRef, useState } from 'react';
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
  const wrongFlashCount = useGameStore((s) => s.wrongFlashCount);
  const timeoutFlashCount = useGameStore((s) => s.timeoutFlashCount);

  const [shaking, setShaking] = useState(false);
  const [timeoutFlashing, setTimeoutFlashing] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    startGame('single');
  }, [startGame]);

  // 오답 → 화면 흔들림
  useEffect(() => {
    if (wrongFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 400);
  }, [wrongFlashCount]);

  // 타임아웃 → 붉은 비네트
  useEffect(() => {
    if (timeoutFlashCount === 0) return;
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    setTimeoutFlashing(true);
    timeoutTimer.current = setTimeout(() => setTimeoutFlashing(false), 700);
  }, [timeoutFlashCount]);

  useGameLoop();
  useKeyboard({ enabled: status === 'playing' });

  return (
    <div className={`ingame${shaking ? ' ingame--shake' : ''}`}>
      {timeoutFlashing && <div className="timeout-vignette" />}
      <HpBar hp={hp} />
      <OrderQueue orders={orders} currentBurger={currentBurger} />
      <ScoreBoard score={score} combo={combo} />
      <InputPanel />
      {status === 'gameover' && <GameOverScreen />}
    </div>
  );
}
