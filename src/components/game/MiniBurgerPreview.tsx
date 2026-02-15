'use client';

import { useEffect, useRef } from 'react';
import type { Ingredient } from '@/types';

const INGREDIENT_IMAGES: Record<Ingredient, string> = {
  patty:  '/ingredient/patty.png',
  cheese: '/ingredient/cheese.png',
  veggie: '/ingredient/vegetable.png',
  sauce:  '/ingredient/sauce.png',
  onion:  '/ingredient/onion.png',
  tomato: '/ingredient/tomato.png',
};

interface MiniBurgerPreviewProps {
  ingredients: Ingredient[];
}

export default function MiniBurgerPreview({ ingredients }: MiniBurgerPreviewProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const foodRef = useRef<HTMLDivElement>(null);

  // 재료가 바뀔 때마다: 컨테이너 높이를 넘으면 너비를 줄여 비율 유지
  useEffect(() => {
    const wrap = wrapRef.current;
    const food = foodRef.current;
    if (!wrap || !food) return;

    food.style.width = '100%';
    food.style.margin = '';

    const availableH = wrap.clientHeight;
    const naturalH = food.scrollHeight;

    if (naturalH > availableH && availableH > 0) {
      const scale = availableH / naturalH;
      food.style.width = `${scale * 100}%`;
      food.style.margin = '0 auto';
    }
  }, [ingredients]);

  return (
    <div className="mini-burger-wrap" ref={wrapRef}>
      <div className="mini-burger" ref={foodRef}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ingredient/bun_bottom.png" alt="" className="mini-burger__bun" />
        {ingredients.map((ing, i) => (
          <div key={i} className={`mini-burger__ing mini-burger__ing--${ing}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
          </div>
        ))}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ingredient/bun_top.png" alt="" className="mini-burger__bun mini-burger__bun--top" />
      </div>
    </div>
  );
}
