'use client';

import { useEffect, useState } from 'react';
import type { Ingredient } from '@/types';
import { useGameStore } from '@/stores/gameStore';
import BurgerStack from './BurgerStack';

interface InputPanelProps {
  allowedActions?: string[];
}

const KEY_HINTS: Record<string, string> = {
  patty:  '↑ W',
  cheese: '↓ S',
  veggie: '← A',
  sauce:  '→ D',
  cancel: 'ESC',
  submit: 'SPC',
};

const INGREDIENT_IMAGES: Record<string, string> = {
  patty:  '/ingredient/patty.png',
  cheese: '/ingredient/cheese.png',
  veggie: '/ingredient/vegetable.png',
  sauce:  '/ingredient/sauce.png',
};

function InputBtn({
  action, label, className, disabled, showKey, onClick,
}: {
  action: string; label: string; className: string;
  disabled: boolean; showKey: boolean; onClick: () => void;
}) {
  const hasImage = action in INGREDIENT_IMAGES;
  return (
    <button className={`input-btn ${className}`} onClick={onClick} disabled={disabled}>
      {hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={INGREDIENT_IMAGES[action]}
          alt={label}
          className="input-btn__img"
        />
      )}
      <span className="input-btn__label">{label}</span>
      {showKey && <kbd className="input-btn__key">{KEY_HINTS[action]}</kbd>}
    </button>
  );
}

export default function InputPanel({ allowedActions }: InputPanelProps) {
  const addIngredient = useGameStore((s) => s.addIngredient);
  const removeLastIngredient = useGameStore((s) => s.removeLastIngredient);
  const submitBurger = useGameStore((s) => s.submitBurger);
  const currentBurger = useGameStore((s) => s.currentBurger);
  const status = useGameStore((s) => s.status);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isAllowed = (action: string) =>
    !allowedActions || allowedActions.includes(action);

  const handleAction = (action: string | Ingredient) => {
    if (status !== 'playing') return;
    if (action === 'cancel') removeLastIngredient();
    else if (action === 'submit') submitBurger();
    else addIngredient(action as Ingredient);
  };

  return (
    <div className="ingame__bottom">
      {/* 버거 스택 (중앙, 남은 공간 차지) */}
      <div className="ingame__burger-area">
        <BurgerStack ingredients={currentBurger} />
      </div>

      {/* 액션 버튼 행: 취소 + 완성 */}
      <div className="ingame__action-row">
        <InputBtn action="cancel" label="취소" className="input-btn--cancel"
          disabled={!isAllowed('cancel')} showKey={isDesktop} onClick={() => handleAction('cancel')} />
        <InputBtn action="submit" label="완성" className="input-btn--submit"
          disabled={!isAllowed('submit')} showKey={isDesktop} onClick={() => handleAction('submit')} />
      </div>

      {/* 재료 2×2 그리드 */}
      <div className="ingame__grid">
        <InputBtn action="veggie" label="야채" className="input-btn--veggie"
          disabled={!isAllowed('veggie')} showKey={isDesktop} onClick={() => handleAction('veggie')} />
        <InputBtn action="sauce" label="소스" className="input-btn--sauce"
          disabled={!isAllowed('sauce')} showKey={isDesktop} onClick={() => handleAction('sauce')} />
        <InputBtn action="cheese" label="치즈" className="input-btn--cheese"
          disabled={!isAllowed('cheese')} showKey={isDesktop} onClick={() => handleAction('cheese')} />
        <InputBtn action="patty" label="패티" className="input-btn--patty"
          disabled={!isAllowed('patty')} showKey={isDesktop} onClick={() => handleAction('patty')} />
      </div>
    </div>
  );
}
