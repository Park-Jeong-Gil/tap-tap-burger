import type { Ingredient, DifficultyTier } from "@/types";

// ─── HP ───────────────────────────────────────────────
export const HP_MAX = 100;
export const HP_INIT = 100;

export const HP_DELTA = {
  correctSubmit: 15,
  comboSubmit: 20,
  wrongSubmit: -10,
  orderTimeout: -20,
} as const;

// ─── 점수 ─────────────────────────────────────────────
export const BASE_SCORE = 100;

// combo count → multiplier
export const COMBO_MULTIPLIERS: {
  min: number;
  max: number;
  multiplier: number;
}[] = [
  { min: 1, max: 2, multiplier: 1.5 },
  { min: 3, max: 5, multiplier: 2.0 },
  { min: 6, max: 9, multiplier: 3.0 },
  { min: 10, max: Infinity, multiplier: 5.0 },
];

// ─── 난이도 스케일링 (주문 순번 기반) ────────────────
// minOrders: 해당 티어가 적용되기 시작하는 누적 주문 인덱스
export const DIFFICULTY_TIERS: { minOrders: number; tier: DifficultyTier }[] = [
  {
    minOrders: 0,
    tier: { minIngredients: 3, timerMultiplier: 2.2, hpDrainPerSec: 0.4 },
    // tier: { minIngredients: 10, timerMultiplier: 20, hpDrainPerSec: 0.4 },
  }, // 시작
  {
    minOrders: 6,
    tier: { minIngredients: 4, timerMultiplier: 2, hpDrainPerSec: 0.8 },
    // tier: { minIngredients: 4, timerMultiplier: 10, hpDrainPerSec: 0.8 },
  }, // 적응
  {
    minOrders: 10,
    tier: { minIngredients: 5, timerMultiplier: 1.8, hpDrainPerSec: 1.2 },
    // tier: { minIngredients: 5, timerMultiplier: 10, hpDrainPerSec: 1.2 },
  }, // 적응
  {
    minOrders: 15,
    tier: { minIngredients: 6, timerMultiplier: 1.6, hpDrainPerSec: 1.6 },
    // tier: { minIngredients: 6, timerMultiplier: 10, hpDrainPerSec: 1.6 },
  }, // 가속
  {
    minOrders: 20,
    tier: { minIngredients: 7, timerMultiplier: 1.4, hpDrainPerSec: 2.2 },
    // tier: { minIngredients: 7, timerMultiplier: 10, hpDrainPerSec: 2.2 },
  }, // 압박
  {
    minOrders: 25,
    tier: { minIngredients: 8, timerMultiplier: 0.8, hpDrainPerSec: 3.2 },
  }, // 위기
  {
    minOrders: 30,
    tier: { minIngredients: 9, timerMultiplier: 0.6, hpDrainPerSec: 4.5 },
  }, // 극한
  {
    minOrders: 45,
    tier: { minIngredients: 11, timerMultiplier: 0.46, hpDrainPerSec: 6.0 },
  }, // 광기
  {
    minOrders: 50,
    tier: { minIngredients: 12, timerMultiplier: 0.38, hpDrainPerSec: 8.0 },
  }, // 지옥
];

// ─── 재료 ─────────────────────────────────────────────
export const INGREDIENTS: Ingredient[] = [
  "patty",
  "cheese",
  "veggie",
  "sauce",
  "onion",
  "tomato",
];

// ─── 키 맵핑 ──────────────────────────────────────────
export const KEY_MAP: Record<string, Ingredient | "cancel" | "submit"> = {
  w: "patty",
  W: "patty",
  s: "cheese",
  S: "cheese",
  a: "veggie",
  A: "veggie",
  d: "sauce",
  D: "sauce",
  q: "onion",
  Q: "onion",
  e: "tomato",
  E: "tomato",
  Escape: "cancel",
  Backspace: "cancel",
  Enter: "submit",
  " ": "submit",
};

// 코업: 모든 가능한 키 (랜덤 배분용)
export const ALL_COOP_ACTIONS = [
  "patty",
  "cheese",
  "veggie",
  "sauce",
  "onion",
  "tomato",
  "cancel",
  "submit",
] as const;

// ─── 타이머 ───────────────────────────────────────────
export const BASE_SECONDS_PER_INGREDIENT = 1.0; // 재료 1개당 기본 초
export const MULTI_MAX_INGREDIENTS = 6; // 멀티 모드 재료 최대 개수
export const ORDER_REFRESH_DELAY_MS = 800;
export const FEVER_SECONDS = 6;
export const FEVER_INTERVAL_CLEARS = 5;
export const FEVER_SCORE_PER_STACK = 50;
export const FEVER_TIMEOUT_GRACE_SECONDS = 0.3;

// ─── localStorage 키 ──────────────────────────────────
export const SESSION_STORAGE_KEY = "ttb_session_id";
export const NICKNAME_STORAGE_KEY = "ttb_nickname";
export const ACTIVE_ROOM_STORAGE_KEY = "ttb_active_room";
