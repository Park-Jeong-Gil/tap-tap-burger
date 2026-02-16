import { v4 as uuidv4 } from "uuid";
import type { Ingredient, Order, DifficultyTier } from "@/types";
import {
  INGREDIENTS,
  DIFFICULTY_TIERS,
  COMBO_MULTIPLIERS,
  BASE_SCORE,
  BASE_SECONDS_PER_INGREDIENT,
  FEVER_SECONDS,
} from "./constants";

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
function getAvailableIngredients(): Ingredient[] {
  return INGREDIENTS; // 모든 재료 처음부터 해금
}

// ─── 시드 기반 랜덤 (협동 모드에서 두 클라이언트가 동일한 주문서를 생성하기 위해) ──
function makeRng(seed?: number): () => number {
  if (seed === undefined) return Math.random;
  // mulberry32 PRNG — 같은 시드는 항상 같은 시퀀스를 생성
  let s = seed + 0x6D2B79F5;
  return () => {
    s = Math.imul(s ^ (s >>> 15), 1 | s);
    s = s + Math.imul(s ^ (s >>> 7), 61 | s) ^ s;
    return ((s ^ (s >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomIngredient(rng: () => number): Ingredient {
  return INGREDIENTS[Math.floor(rng() * INGREDIENTS.length)];
}

// ─── 주문서 생성 ──────────────────────────────────
// prevTime이 없으면 → 순번 기반 기본 시간
// prevTime이 있으면 → prevTime + 재료수 × mult + 3초 여유
// seed를 전달하면 결정론적 생성 (협동 모드: 두 클라이언트 동기화)
export function generateOrder(
  orderIndex: number,
  prevTime?: number,
  maxIngredients?: number,
  seed?: number,
): Order {
  const rng = makeRng(seed);
  const diff = getDifficulty(orderIndex);
  const available = getAvailableIngredients();
  const count =
    maxIngredients !== undefined
      ? Math.min(diff.minIngredients, maxIngredients)
      : diff.minIngredients;

  // 연속 동일 재료 방지: 이전 재료와 다른 재료를 우선 선택
  const ingredients: Ingredient[] = [];
  for (let i = 0; i < count; i++) {
    const pool =
      available.length > 1 && ingredients.length > 0
        ? available.filter((ing) => ing !== ingredients[ingredients.length - 1])
        : available;
    ingredients.push(pool[Math.floor(rng() * pool.length)]);
  }

  let timeLimit: number;
  if (prevTime !== undefined) {
    timeLimit =
      prevTime + count * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier + 1;
  } else {
    const rawTime = count * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier;
    timeLimit = Math.max(rawTime, count * 1.0);
  }

  return {
    id: uuidv4(),
    type: "normal",
    ingredients,
    timeLimit,
    elapsed: 0,
    orderIndex,
  };
}

export function generateFeverOrder(
  orderIndex: number,
  feverCycle: number,
  seed?: number,
): Order {
  const rng = makeRng(seed);
  const feverIngredient = pickRandomIngredient(rng);
  return {
    id: uuidv4(),
    type: "fever",
    ingredients: [feverIngredient],
    feverIngredient,
    feverCycle,
    timeLimit: FEVER_SECONDS,
    elapsed: 0,
    orderIndex,
  };
}

// ─── 번거 검증 ────────────────────────────────────
export function validateBurger(
  submitted: Ingredient[],
  expected: Ingredient[],
): boolean {
  if (submitted.length !== expected.length) return false;
  return submitted.every((ing, i) => ing === expected[i]);
}

// ─── 콤보 판정 ────────────────────────────────────
// 제한시간의 65% 이내에 완성해야 콤보
export function isCombo(elapsed: number, timeLimit: number): boolean {
  return elapsed < timeLimit * 0.65;
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
  const num = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `player${num}`;
}

// ─── 코업 키 배분 ─────────────────────────────────
// roomId를 시드로 사용해 두 플레이어가 항상 동일한 분할 결과를 계산
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr];
  // 문자열 → 32비트 정수 해시
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(hash, 31) + seed.charCodeAt(i)) | 0;
  }
  // Fisher-Yates + LCG
  for (let i = result.length - 1; i > 0; i--) {
    hash = (Math.imul(hash, 1664525) + 1013904223) | 0;
    const j = Math.abs(hash) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 재료 6개를 3/3으로 나누고, 완성 버튼은 둘 다 포함
export function assignCoopKeys(roomId: string): [string[], string[]] {
  const ingredients = ["patty", "cheese", "veggie", "sauce", "onion", "tomato"];
  const shuffled = seededShuffle(ingredients, roomId);
  return [
    [...shuffled.slice(0, 3), "submit"],
    [...shuffled.slice(3), "submit"],
  ];
}
