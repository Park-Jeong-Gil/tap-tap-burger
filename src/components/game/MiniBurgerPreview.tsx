'use client';

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
  return (
    <div className="mini-burger">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/ingredient/bun_bottom.png" alt="" className="mini-burger__bun" />
      {ingredients.map((ing, i) => (
        <div key={i} className={`mini-burger__ing mini-burger__ing--${ing}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
        </div>
      ))}
    </div>
  );
}
