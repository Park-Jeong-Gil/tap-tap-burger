'use client';

import { useEffect, useRef } from 'react';
import { useGameStore } from '@/stores/gameStore';

export function useGameLoop() {
  const tick = useGameStore((s) => s.tick);
  const status = useGameStore((s) => s.status);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (status !== 'playing') {
      cancelAnimationFrame(rafRef.current);
      return;
    }

    const loop = (now: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = now;
      const delta = (now - lastTimeRef.current) / 1000; // seconds
      lastTimeRef.current = now;

      // 최대 delta 0.1초로 제한 (탭 전환 등으로 인한 점프 방지)
      tick(Math.min(delta, 0.1));

      rafRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = 0;
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      lastTimeRef.current = 0;
    };
  }, [status, tick]);
}
