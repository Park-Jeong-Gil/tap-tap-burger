import { v4 as uuidv4 } from 'uuid';
import type { Ingredient, Order, DifficultyTier } from '@/types';
import {
  INGREDIENTS,
  DIFFICULTY_TIERS,
  COMBO_MULTIPLIERS,
  BASE_SCORE,
  BASE_SECONDS_PER_INGREDIENT,
} from './constants';

// ─── 난이도 계산 (주문 순번 기반) ───────────────────
export function getDifficulty(orderCount: number): DifficultyTier {
  for (let i = DIFFICULTY_TIERS.length - 1; i >= 0; i--) {
    if (orderCount >= DIFFICULTY_TIERS[i].minOrders) {
      return DIFFICULTY_TIERS[i].tier;
    }
  }
  return DIFFICULTY_TIERS[0].tier;
}

// ─── 순번 기반 재료 해금 ──────────────────────────
// 초반: 패티·치즈만 → 야채 추가 → 소스 추가 (전체 해금)
function getAvailableIngredients(_orderIndex: number): Ingredient[] {
  return INGREDIENTS; // 모든 재료 처음부터 해금
}

// ─── 난이도 티어 기반 재료 개수 범위 ─────────────
// 각 티어의 minIngredients를 최솟값으로, +2 랜덤 폭
function getIngredientCountRange(orderIndex: number): { min: number; max: number } {
  const min = getDifficulty(orderIndex).minIngredients;
  const max = min + 2;
  return { min, max };
}

// ─── 주문서 생성 ──────────────────────────────────
// prevTime이 없으면 → 순번 기반 기본 시간
// prevTime이 있으면 → prevTime + 재료수 × mult + 3초 여유
export function generateOrder(orderIndex: number, prevTime?: number): Order {
  const diff = getDifficulty(orderIndex);
  const available = getAvailableIngredients(orderIndex);
  const { min, max } = getIngredientCountRange(orderIndex);
  const count = Math.floor(Math.random() * (max - min + 1)) + min;

  // 연속 동일 재료 방지: 이전 재료와 다른 재료를 우선 선택
  const ingredients: Ingredient[] = [];
  for (let i = 0; i < count; i++) {
    const pool = available.length > 1 && ingredients.length > 0
      ? available.filter(ing => ing !== ingredients[ingredients.length - 1])
      : available;
    ingredients.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  let timeLimit: number;
  if (prevTime !== undefined) {
    timeLimit = prevTime + count * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier + 1;
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

// ─── 번거 검증 ────────────────────────────────────
export function validateBurger(submitted: Ingredient[], expected: Ingredient[]): boolean {
  if (submitted.length !== expected.length) return false;
  return submitted.every((ing, i) => ing === expected[i]);
}

// ─── 콤보 판정 ────────────────────────────────────
// 시간의 절반 이내에 완성해야 콤보 (빠른 플레이 요구)
export function isCombo(elapsed: number, timeLimit: number): boolean {
  return elapsed < timeLimit * 0.5;
}

// ─── 콤보 배율 ────────────────────────────────────
export function getComboMultiplier(combo: number): number {
  if (combo === 0) return 1.0;
  for (let i = COMBO_MULTIPLIERS.length - 1; i >= 0; i--) {
    if (combo >= COMBO_MULTIPLIERS[i].min) {
      return COMBO_MULTIPLIERS[i].multiplier;
    }
  }
  return 1.0;
}

// ─── 점수 계산 ────────────────────────────────────
export function calcScore(combo: number): number {
  return Math.round(BASE_SCORE * getComboMultiplier(combo));
}

// ─── 랜덤 닉네임 ─────────────────────────────────
export function generateDefaultNickname(): string {
  const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `player${num}`;
}

// ─── 코업 키 배분 ─────────────────────────────────
export function assignCoopKeys(): [string[], string[]] {
  const actions = ['patty', 'cheese', 'veggie', 'sauce', 'cancel', 'submit'];
  const shuffled = [...actions].sort(() => Math.random() - 0.5);
  return [shuffled.slice(0, 3), shuffled.slice(3)];
}
