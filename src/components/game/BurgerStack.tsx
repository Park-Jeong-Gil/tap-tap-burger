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
  // 완성 플래시 동안 재료 스냅샷 유지 (currentBurger는 즉시 리셋되므로)
  const lastSubmittedBurger = useGameStore((s) => s.lastSubmittedBurger);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!submitFlash) return;
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(clearFlash, 560);
    return () => { if (flashTimeout.current) clearTimeout(flashTimeout.current); };
  }, [submitFlash, clearFlash]);

  // 완성 플래시 중에는 제출 직전의 재료를 표시
  const displayIngredients = submitFlash === 'correct' ? lastSubmittedBurger : ingredients;

  return (
    <div className="burger-stack">
      {/* 아래 번 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ingredient/bun_bottom.png" alt="bun-bottom" className="burger-bun" />

      {/* 재료 레이어 (아래→위, column-reverse로 쌓임) */}
      {displayIngredients.map((ing, i) => (
        <div key={i} className={`ingredient-layer ingredient-layer--${ing}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
        </div>
      ))}

      {/* 완성 시 위 번이 떨어지는 애니메이션 (column-reverse → 마지막 자식 = 시각적 최상단) */}
      {submitFlash === 'correct' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/ingredient/bun_top.png"
          alt="bun-top"
          className="burger-bun burger-bun--top-drop"
        />
      )}

      {/* 제출 결과 플래시 */}
      {submitFlash && (
        <div className={`burger-flash burger-flash--${submitFlash}`}>
          {submitFlash === 'correct' ? '✓' : '✗'}
        </div>
      )}
    </div>
  );
}
