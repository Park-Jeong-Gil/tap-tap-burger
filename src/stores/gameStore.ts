'use client';

import { create } from 'zustand';
import type { Ingredient, Order, GameStatus, GameMode } from '@/types';
import { HP_MAX, HP_INIT, HP_DELTA, BASE_SECONDS_PER_INGREDIENT, INGREDIENTS, MULTI_MAX_INGREDIENTS } from '@/lib/constants';
import {
  generateOrder,
  validateBurger,
  isCombo,
  calcScore,
  getDifficulty,
} from '@/lib/gameLogic';
import { upsertScore, getBestScore } from '@/lib/supabase';

const INITIAL_ORDER_COUNT = 3;

interface GameState {
  status: GameStatus;
  hp: number;
  score: number;
  combo: number;
  maxCombo: number;
  orders: Order[];
  currentBurger: Ingredient[];
  lastSubmittedBurger: Ingredient[]; // 완성 플래시 중 표시용 스냅샷
  orderCounter: number; // 총 생성된 주문서 수 (순번 기반 난이도 계산용)
  submitFlash: 'correct' | 'wrong' | null;
  lastScoreGain: number;     // 마지막 정답 제출로 얻은 점수
  lastComboOnSubmit: number; // 제출 시점의 콤보 수 (0 = 콤보 없음)
  wrongFlashCount: number;          // 오답 시 증가 → 화면 흔들림 트리거
  timeoutFlashCount: number;        // 타임아웃 시 증가 → 경고 비네트 트리거
  clearedCount: number;             // 정답 제출한 누적 주문서 수
  attackReceivedFlashCount: number; // 공격 받을 때 증가 → 피격 오버레이 트리거
  attackReceivedCount: number;      // 마지막 피격 주문서 수
  inputLockedAt: number;            // 입력 잠금 타임스탬프 (0=해제, >0=잠금 중)
  mode: GameMode;

  // actions
  startGame: (mode?: GameMode) => void;
  resetGame: () => void;
  addIngredient: (ingredient: Ingredient) => void;
  removeLastIngredient: () => void;
  clearBurger: () => void;
  submitBurger: () => void;
  tick: (delta: number) => void; // delta: seconds
  saveScore: (playerId: string) => Promise<boolean>;
  addOrdersFromAttack: (count: number) => void; // versus: 상대 공격
  clearFlash: () => void;
}

// FIFO 시스템: 각 주문은 활성화될 때 fresh 타이머로 독립 생성
function createInitialOrders(count: number, maxIngredients?: number): { orders: Order[]; counter: number } {
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    orders.push(generateOrder(i, undefined, maxIngredients));
  }
  return { orders, counter: count };
}

export const useGameStore = create<GameState>((set, get) => ({
  status: 'idle',
  hp: HP_INIT,
  score: 0,
  combo: 0,
  maxCombo: 0,
  orders: [],
  currentBurger: [],
  lastSubmittedBurger: [],
  orderCounter: 0,
  submitFlash: null,
  lastScoreGain: 0,
  lastComboOnSubmit: 0,
  wrongFlashCount: 0,
  timeoutFlashCount: 0,
  clearedCount: 0,
  attackReceivedFlashCount: 0,
  attackReceivedCount: 0,
  inputLockedAt: 0,
  mode: 'single',

  startGame: (mode = 'single') => {
    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    const { orders, counter } = createInitialOrders(INITIAL_ORDER_COUNT, maxIng);
    set({
      status: 'playing',
      hp: HP_INIT,
      score: 0,
      combo: 0,
      maxCombo: 0,
      orders,
      currentBurger: [],
      lastSubmittedBurger: [],
      orderCounter: counter,
      submitFlash: null,
      lastScoreGain: 0,
      lastComboOnSubmit: 0,
      wrongFlashCount: 0,
      timeoutFlashCount: 0,
      clearedCount: 0,
      attackReceivedFlashCount: 0,
      attackReceivedCount: 0,
      inputLockedAt: 0,
      mode,
    });
  },

  resetGame: () => {
    set({
      status: 'idle',
      hp: HP_INIT,
      score: 0,
      combo: 0,
      maxCombo: 0,
      orders: [],
      currentBurger: [],
      lastSubmittedBurger: [],
      orderCounter: 0,
      submitFlash: null,
      lastScoreGain: 0,
      lastComboOnSubmit: 0,
      wrongFlashCount: 0,
      timeoutFlashCount: 0,
      clearedCount: 0,
      attackReceivedFlashCount: 0,
      attackReceivedCount: 0,
      inputLockedAt: 0,
    });
  },

  addIngredient: (ingredient) => {
    const { status, currentBurger, inputLockedAt } = get();
    if (status !== 'playing') return;
    if (inputLockedAt > 0 && Date.now() - inputLockedAt < 200) return;
    set({ currentBurger: [...currentBurger, ingredient] });
  },

  removeLastIngredient: () => {
    const { status, currentBurger } = get();
    if (status !== 'playing' || currentBurger.length === 0) return;
    set({ currentBurger: currentBurger.slice(0, -1) });
  },

  clearBurger: () => {
    const { status, currentBurger } = get();
    if (status !== 'playing' || currentBurger.length === 0) return;
    set({ currentBurger: [] });
  },

  submitBurger: () => {
    const { status, orders, currentBurger, combo, maxCombo, score, hp, inputLockedAt } = get();
    if (status !== 'playing' || orders.length === 0 || currentBurger.length === 0) return;
    if (inputLockedAt > 0 && Date.now() - inputLockedAt < 200) return;

    const targetOrder = orders[0];
    const isValid = validateBurger(currentBurger, targetOrder.ingredients);

    if (!isValid) {
      const newHp = Math.max(0, hp + HP_DELTA.wrongSubmit);
      set({
        hp: newHp,
        currentBurger: [],
        combo: 0,
        submitFlash: 'wrong',
        status: newHp <= 0 ? 'gameover' : 'playing',
        wrongFlashCount: get().wrongFlashCount + 1,
        lastScoreGain: 0,
        lastComboOnSubmit: 0,
      });
      return;
    }

    const wasCombo = isCombo(targetOrder.elapsed, targetOrder.timeLimit);
    const newCombo = wasCombo ? combo + 1 : 0;
    const points = calcScore(newCombo);
    const newScore = score + points;
    const newMaxCombo = Math.max(maxCombo, newCombo);
    const hpDelta = wasCombo ? HP_DELTA.comboSubmit : HP_DELTA.correctSubmit;
    const newHp = Math.min(HP_MAX, hp + hpDelta);

    // 소비된 주문서 제거 후 새 주문서 추가 (순번 기반)
    const { orderCounter, mode } = get();
    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    const remaining = orders.slice(1);
    const newOrder = generateOrder(orderCounter, undefined, maxIng);
    const newOrders = [...remaining, newOrder];

    set({
      hp: newHp,
      score: newScore,
      combo: newCombo,
      maxCombo: newMaxCombo,
      orders: newOrders,
      currentBurger: [],
      lastSubmittedBurger: [...currentBurger], // 플래시 동안 재료 스냅샷 유지
      orderCounter: orderCounter + 1,
      clearedCount: get().clearedCount + 1,
      submitFlash: 'correct',
      lastScoreGain: points,
      lastComboOnSubmit: wasCombo ? newCombo : 0,
      inputLockedAt: Date.now(),
    });
  },

  tick: (delta: number) => {
    const { status, orders, hp, timeoutFlashCount } = get();
    if (status !== 'playing' || orders.length === 0) return;

    let { orderCounter } = get();
    const diff = getDifficulty(orderCounter);
    let newHp = hp - diff.hpDrainPerSec * delta;

    // 첫 번째 주문서만 타이머 진행 (나머지는 FIFO 대기, 타이머 정지)
    const active = orders[0];
    const newElapsed = active.elapsed + delta;
    const timedOut = newElapsed >= active.timeLimit;

    let queueOrders: Order[];
    if (timedOut) {
      queueOrders = orders.slice(1);
      newHp += HP_DELTA.orderTimeout;
    } else {
      queueOrders = [{ ...active, elapsed: newElapsed }, ...orders.slice(1)];
    }

    newHp = Math.max(0, newHp);

    // 타임아웃 시 새 주문서 보충
    const { mode } = get();
    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    if (timedOut) {
      queueOrders.push(generateOrder(orderCounter, undefined, maxIng));
      orderCounter++;
    }

    set({
      hp: newHp,
      orders: queueOrders, // FIFO 순서 유지, 정렬 없음
      orderCounter,
      status: newHp <= 0 ? 'gameover' : 'playing',
      ...(timedOut ? {
        combo: 0,
        currentBurger: [],
        timeoutFlashCount: timeoutFlashCount + 1,
        inputLockedAt: Date.now(),
      } : {}),
    });
  },

  saveScore: async (playerId: string) => {
    const { score, maxCombo, mode } = get();
    try {
      const prev = await getBestScore(playerId, mode);
      await upsertScore(playerId, mode, score, maxCombo);
      return prev === null || score > prev;
    } catch {
      return false;
    }
  },

  addOrdersFromAttack: (count: number) => {
    const { orders, orderCounter } = get();
    if (orders.length === 0) return;

    // 남은 시간이 가장 많은 마지막 주문서에 재료 추가 (최대 MULTI_MAX_INGREDIENTS까지)
    const lastIdx = orders.length - 1;
    const target = orders[lastIdx];

    const extra: Ingredient[] = Array.from({ length: count }, () =>
      INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)]
    );
    const extraTime = count * BASE_SECONDS_PER_INGREDIENT * getDifficulty(orderCounter).timerMultiplier;

    const newOrders = [...orders];
    newOrders[lastIdx] = {
      ...target,
      ingredients: [...target.ingredients, ...extra],
      timeLimit: target.timeLimit + extraTime,
    };

    set({
      orders: newOrders,
      attackReceivedFlashCount: get().attackReceivedFlashCount + 1,
      attackReceivedCount: count,
    });
  },

  clearFlash: () => set({ submitFlash: null, lastSubmittedBurger: [], lastScoreGain: 0, lastComboOnSubmit: 0 }),
}));
