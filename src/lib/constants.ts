import type { Ingredient, DifficultyTier } from '@/types';

// ─── HP ───────────────────────────────────────────────
export const HP_MAX = 100;
export const HP_INIT = 80;

export const HP_DELTA = {
  correctSubmit:  12,
  comboSubmit:    18,
  wrongSubmit:   -25,
  orderTimeout:  -30,
} as const;

// ─── 점수 ─────────────────────────────────────────────
export const BASE_SCORE = 100;

// combo count → multiplier
export const COMBO_MULTIPLIERS: { min: number; max: number; multiplier: number }[] = [
  { min: 1,  max: 2,        multiplier: 1.5 },
  { min: 3,  max: 5,        multiplier: 2.0 },
  { min: 6,  max: 9,        multiplier: 3.0 },
  { min: 10, max: Infinity, multiplier: 5.0 },
];

// ─── 난이도 스케일링 (주문 순번 기반) ────────────────
// minOrders: 해당 티어가 적용되기 시작하는 누적 주문 인덱스
export const DIFFICULTY_TIERS: { minOrders: number; tier: DifficultyTier }[] = [
  { minOrders: 0,   tier: { maxIngredients: 3,  timerMultiplier: 1.50, hpDrainPerSec: 1.5  } }, // 시작부터 긴장
  { minOrders: 5,   tier: { maxIngredients: 5,  timerMultiplier: 1.20, hpDrainPerSec: 3.0  } }, // 압박 시작
  { minOrders: 13,  tier: { maxIngredients: 6,  timerMultiplier: 1.00, hpDrainPerSec: 5.0  } }, // 빠른 가속
  { minOrders: 25,  tier: { maxIngredients: 7,  timerMultiplier: 0.82, hpDrainPerSec: 7.5  } }, // 위기
  { minOrders: 40,  tier: { maxIngredients: 8,  timerMultiplier: 0.68, hpDrainPerSec: 10.5 } }, // 극한
  { minOrders: 60,  tier: { maxIngredients: 9,  timerMultiplier: 0.56, hpDrainPerSec: 14.0 } }, // 스피드런
  { minOrders: 90,  tier: { maxIngredients: 11, timerMultiplier: 0.46, hpDrainPerSec: 18.5 } }, // 광기
  { minOrders: 125, tier: { maxIngredients: 12, timerMultiplier: 0.38, hpDrainPerSec: 24.0 } }, // 지옥
];

// ─── 재료 ─────────────────────────────────────────────
export const INGREDIENTS: Ingredient[] = ['patty', 'cheese', 'veggie', 'sauce'];

// ─── 키 맵핑 ──────────────────────────────────────────
export const KEY_MAP: Record<string, Ingredient | 'cancel' | 'submit'> = {
  ArrowUp:    'patty',
  w:          'patty',
  W:          'patty',
  ArrowDown:  'cheese',
  s:          'cheese',
  S:          'cheese',
  ArrowLeft:  'veggie',
  a:          'veggie',
  A:          'veggie',
  ArrowRight: 'sauce',
  d:          'sauce',
  D:          'sauce',
  Escape:     'cancel',
  Backspace:  'cancel',
  Enter:      'submit',
  ' ':        'submit',
};

// 코업: 모든 가능한 키 (랜덤 배분용)
export const ALL_COOP_ACTIONS = ['patty', 'cheese', 'veggie', 'sauce', 'cancel', 'submit'] as const;

// ─── 타이머 ───────────────────────────────────────────
export const BASE_SECONDS_PER_INGREDIENT = 1.0; // 재료 1개당 기본 초

// ─── localStorage 키 ──────────────────────────────────
export const SESSION_STORAGE_KEY = 'ttb_session_id';
export const NICKNAME_STORAGE_KEY = 'ttb_nickname';
