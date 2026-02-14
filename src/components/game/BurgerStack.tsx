'use client';

import { useEffect, useRef, useState } from 'react';
import type { Ingredient } from '@/types';
import { useGameStore } from '@/stores/gameStore';
import { getComboMultiplier } from '@/lib/gameLogic';

const INGREDIENT_IMAGES: Record<Ingredient, string> = {
  patty:  '/ingredient/patty.png',
  cheese: '/ingredient/cheese.png',
  veggie: '/ingredient/vegetable.png',
  sauce:  '/ingredient/sauce.png',
  onion:  '/ingredient/onion.png',
  tomato: '/ingredient/tomato.png',
};

interface BurgerStackProps {
  ingredients: Ingredient[];
}

export default function BurgerStack({ ingredients }: BurgerStackProps) {
  const submitFlash = useGameStore((s) => s.submitFlash);
  const clearFlash = useGameStore((s) => s.clearFlash);
  // 완성 플래시 동안 재료 스냅샷 유지 (currentBurger는 즉시 리셋되므로)
  const lastSubmittedBurger = useGameStore((s) => s.lastSubmittedBurger);
  const lastScoreGain = useGameStore((s) => s.lastScoreGain);
  const lastComboOnSubmit = useGameStore((s) => s.lastComboOnSubmit);

  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevFlash = useRef<'correct' | 'wrong' | null>(null);

  // 바닥 번 등장 애니메이션 트리거 (correct flash 해제 후)
  const [freshBun, setFreshBun] = useState(false);
  const freshBunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 카메라 효과: 버거가 영역을 넘으면 최상단을 따라감
  const stackRef = useRef<HTMLDivElement>(null);
  const foodRef = useRef<HTMLDivElement>(null);
  const [cameraY, setCameraY] = useState(0);

  // 600ms 후 flash 해제 (제출 애니메이션 완료 대기)
  useEffect(() => {
    if (!submitFlash) return;
    if (flashTimeout.current) clearTimeout(flashTimeout.current);
    flashTimeout.current = setTimeout(clearFlash, 600);
    return () => { if (flashTimeout.current) clearTimeout(flashTimeout.current); };
  }, [submitFlash, clearFlash]);

  // correct → null 전환 감지 → 바닥 번 등장 애니메이션
  useEffect(() => {
    if (prevFlash.current === 'correct' && submitFlash === null) {
      if (freshBunTimer.current) clearTimeout(freshBunTimer.current);
      setFreshBun(true);
      freshBunTimer.current = setTimeout(() => setFreshBun(false), 400);
    }
    prevFlash.current = submitFlash;
  }, [submitFlash]);

  const isSubmitting = submitFlash === 'correct';
  // 제출 중에는 스냅샷 재료를 표시, 그 외엔 현재 쌓는 중인 재료
  const displayIngredients = isSubmitting ? lastSubmittedBurger : ingredients;

  // 재료가 변할 때마다 카메라 위치 및 스케일 재계산
  useEffect(() => {
    const stack = stackRef.current;
    const food = foodRef.current;
    if (!stack || !food) return;

    // 자연 높이 측정을 위해 너비를 일시적으로 100%로 초기화
    food.style.width = '100%';
    food.style.margin = '';

    const containerH = stack.clientHeight;
    const naturalH = food.scrollHeight;

    if (naturalH > containerH && containerH > 0) {
      // 넘칠 경우: 너비를 줄여 전체가 컨테이너 안에 들어오도록 축소
      const scale = containerH / naturalH;
      food.style.width = `${scale * 100}%`;
      food.style.margin = '0 auto';
      setCameraY(0);
    } else {
      // 정상 범위: 카메라를 위로 올려 버거 상단이 보이게
      const overflow = Math.max(0, naturalH - containerH);
      setCameraY(overflow);
    }
  }, [displayIngredients]);

  return (
    <div className="burger-stack" ref={stackRef}>
      {/* ── 카메라 래퍼: translateY로 버거 상단을 따라감 ── */}
      {/* 제출 중엔 전환 없음 → scale 애니메이션과 충돌 방지 */}
      <div
        className="burger-camera"
        style={{
          transform: `translateY(${cameraY}px)`,
          transition: submitFlash !== null ? 'none' : 'transform 0.12s ease-out',
        }}
      >
        {/* ── 음식 레이어 (제출 시 통째로 애니메이션) ── */}
        <div ref={foodRef} className={`burger-food${isSubmitting ? ' burger-food--submitting' : ''}`}>
          {/* 아래 번 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ingredient/bun_bottom.png"
            alt="bun-bottom"
            className={`burger-bun${freshBun ? ' burger-bun--fresh' : ''}`}
          />

          {/* 재료 레이어 (아래→위, column-reverse로 쌓임) */}
          {displayIngredients.map((ing, i) => (
            <div key={i} className={`ingredient-layer ingredient-layer--${ing}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
            </div>
          ))}

          {/* 완성 시 위 번 (food 레이어와 함께 애니메이션) */}
          {isSubmitting && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/ingredient/bun_top.png"
              alt="bun-top"
              className="burger-bun burger-bun--top"
            />
          )}
        </div>
      </div>

      {/* ── 플래시 오버레이 (카메라 바깥 → 항상 중앙 고정) ── */}
      {isSubmitting && (
        <div className={`burger-flash burger-flash--correct${lastComboOnSubmit > 0 ? ' burger-flash--combo' : ''}`}>
          <span className="burger-flash__score">+{lastScoreGain}</span>
          {lastComboOnSubmit > 0 && (
            <span className="burger-flash__combo">
              ×{getComboMultiplier(lastComboOnSubmit).toFixed(1)} COMBO!
            </span>
          )}
        </div>
      )}
      {submitFlash === 'wrong' && (
        <div className="burger-flash burger-flash--wrong">MISS!</div>
      )}
    </div>
  );
}
