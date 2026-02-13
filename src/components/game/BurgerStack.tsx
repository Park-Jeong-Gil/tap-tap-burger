'use client';

import { useEffect, useRef } from 'react';
import type { Ingredient } from '@/types';
import { useGameStore } from '@/stores/gameStore';

const INGREDIENT_IMAGES: Record<Ingredient, string> = {
  patty:  '/ingredient/patty.png',
  cheese: '/ingredient/cheese.png',
  veggie: '/ingredient/vegetable.png',
  sauce:  '/ingredient/sauce.png',
};

interface BurgerStackProps {
  ingredients: Ingredient[];
}

export default function BurgerStack({ ingredients }: BurgerStackProps) {
  const submitFlash = useGameStore((s) => s.submitFlash);
  const clearFlash = useGameStore((s) => s.clearFlash);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!submitFlash) return;
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(clearFlash, 500);
    return () => { if (flashTimeout.current) clearTimeout(flashTimeout.current); };
  }, [submitFlash, clearFlash]);

  return (
    <div className="burger-stack">
      {/* 아래 번 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ingredient/bun_bottom.png" alt="bun" className="burger-bun" />

      {/* 재료 레이어 (아래→위) */}
      {ingredients.map((ing, i) => (
        <div key={i} className={`ingredient-layer ingredient-layer--${ing}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
        </div>
      ))}

      {/* 제출 플래시 */}
      {submitFlash && (
        <div className={`burger-flash burger-flash--${submitFlash}`}>
          {submitFlash === 'correct' ? '✓' : '✗'}
        </div>
      )}
    </div>
  );
}
