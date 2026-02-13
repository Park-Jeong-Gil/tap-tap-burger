import type { Ingredient, DifficultyTier } from '@/types';

// ─── HP ───────────────────────────────────────────────
export const HP_MAX = 100;
export const HP_INIT = 80;

export const HP_DELTA = {
  correctSubmit:  15,
  comboSubmit:    20,
  wrongSubmit:   -20,
  orderTimeout:  -25,
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
  { minOrders: 0,  tier: { maxIngredients: 2, timerMultiplier: 2.80, hpDrainPerSec: 0.3 } }, // 튜토리얼
  { minOrders: 5,  tier: { maxIngredients: 3, timerMultiplier: 2.30, hpDrainPerSec: 0.8 } }, // 적응
  { minOrders: 12, tier: { maxIngredients: 4, timerMultiplier: 1.90, hpDrainPerSec: 1.5 } }, // 가속
  { minOrders: 22, tier: { maxIngredients: 5, timerMultiplier: 1.60, hpDrainPerSec: 2.5 } }, // 압박
  { minOrders: 38, tier: { maxIngredients: 6, timerMultiplier: 1.35, hpDrainPerSec: 4.0 } }, // 위기
  { minOrders: 60, tier: { maxIngredients: 7, timerMultiplier: 1.15, hpDrainPerSec: 6.0 } }, // 스피드런
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
