import { v4 as uuidv4 } from 'uuid';
import type { Ingredient, Order, DifficultyTier } from '@/types';
import {
  INGREDIENTS,
  DIFFICULTY_TIERS,
  COMBO_MULTIPLIERS,
  BASE_SCORE,
  BASE_SECONDS_PER_INGREDIENT,
} from './constants';

// ─── 난이도 계산 ──────────────────────────────────────
export function getDifficulty(score: number): DifficultyTier {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (score >= DIFFICULTY_TIERS[i].minScore) {
      return DIFFICULTY_TIERS[i].tier;
    }
  }
  return DIFFICULTY_TIERS[0].tier;
}

// ─── 주문서 생성 ──────────────────────────────────────
// prevTime이 없으면 → 난이도 기반 기본 시간 (첫 번째 주문)
// prevTime이 있으면 → prevTime + 3초 + 재료수 × 1초 + 2초 여유 (이후 주문)
export function generateOrder(orderIndex: number, score: number, prevTime?: number): Order {
  const diff = getDifficulty(score);
  const count = Math.min(
    Math.floor(Math.random() * diff.maxIngredients) + 2, // 최소 2개
    diff.maxIngredients
  );

  const ingredients: Ingredient[] = Array.from(
    { length: count },
    () => INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
  );

  let timeLimit: number;
  if (prevTime !== undefined) {
    // 이전 주문 시간 기준 차등 부여: 재료수 × timerMultiplier + 3초 여유
    timeLimit = prevTime + count * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier + 3;
  } else {
    const rawTime = count * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier;
    timeLimit = Math.max(rawTime, count * 1.0);
  }

  return {
    id: uuidv4(),
    ingredients,
    timeLimit,
    elapsed: 0,
    orderIndex,
  };
}

// ─── 번거 검증 ────────────────────────────────────────
export function validateBurger(submitted: Ingredient[], expected: Ingredient[]): boolean {
  if (submitted.length !== expected.length) return false;
  return submitted.every((ing, i) => ing === expected[i]);
}

// ─── 콤보 판정 ────────────────────────────────────────
export function isCombo(elapsed: number, timeLimit: number): boolean {
  return elapsed < timeLimit * (2 / 3);
}

// ─── 콤보 배율 ────────────────────────────────────────
export function getComboMultiplier(combo: number): number {
  if (combo === 0) return 1.0;
  for (let i = COMBO_MULTIPLIERS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_MULTIPLIERS[i].min) {
      return COMBO_MULTIPLIERS[i].multiplier;
    }
  }
  return 1.0;
}

// ─── 점수 계산 ────────────────────────────────────────
export function calcScore(combo: number): number {
  return Math.round(BASE_SCORE * getComboMultiplier(combo));
}

// ─── 랜덤 닉네임 ─────────────────────────────────────
export function generateDefaultNickname(): string {
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `player${num}`;
}

// ─── 코업 키 배분 ─────────────────────────────────────
export function assignCoopKeys(): [string[], string[]] {
  const actions = ['patty', 'cheese', 'veggie', 'sauce', 'cancel', 'submit'];
  const shuffled = [...actions].sort(() => Math.random() - 0.5);
  return [shuffled.slice(0, 3), shuffled.slice(3)];
}
