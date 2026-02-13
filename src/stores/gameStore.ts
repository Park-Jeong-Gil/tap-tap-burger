'use client';

import { create } from 'zustand';
import type { Ingredient, Order, GameStatus, GameMode } from '@/types';
import { HP_MAX, HP_INIT, HP_DELTA, BASE_SECONDS_PER_INGREDIENT } from '@/lib/constants';
import {
  generateOrder,
  validateBurger,
  isCombo,
  calcScore,
  getDifficulty,
} from '@/lib/gameLogic';
import { upsertScore } from '@/lib/supabase';

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
  orderCounter: number; // 총 생성된 주문서 수 (타이머 계산용)
  submitFlash: 'correct' | 'wrong' | null;
  mode: GameMode;

  // actions
  startGame: (mode?: GameMode) => void;
  resetGame: () => void;
  addIngredient: (ingredient: Ingredient) => void;
  removeLastIngredient: () => void;
  submitBurger: () => void;
  tick: (delta: number) => void; // delta: seconds
  saveScore: (playerId: string) => Promise<void>;
  addOrdersFromAttack: (count: number) => void; // versus: 상대 공격
  clearFlash: () => void;
}

/**
 * 새 주문이 추가될 슬롯의 "신선한 prevTime"을 계산한다.
 * 잔여시간(elapsed 반영)이 아닌 첫 번째 주문의 재료 수 × 난이도로 다시 계산해
 * 시간이 무한히 누적되는 문제를 방지한다.
 */
function calcFreshSlotTime(ordersAhead: Order[], score: number): number | undefined {
  if (ordersAhead.length === 0) return undefined;
  const diff = getDifficulty(score);
  // 슬롯 0: 재료수 × timerMultiplier
  let time = ordersAhead[0].ingredients.length * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier;
  // 이후 슬롯: 재료수 × timerMultiplier + 3초 여유 (gap도 난이도 배율 적용)
  for (let i = 1; i < ordersAhead.length; i++) {
    time += ordersAhead[i].ingredients.length * BASE_SECONDS_PER_INGREDIENT * diff.timerMultiplier + 3;
  }
  return time;
}

function createInitialOrders(count: number): { orders: Order[]; counter: number } {
  const orders: Order[] = [];
  let prevTime: number | undefined = undefined;
  for (let i = 0; i < count; i++) {
    const order = generateOrder(i, 0, prevTime);
    orders.push(order);
    prevTime = order.timeLimit;
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
  mode: 'single',

  startGame: (mode = 'single') => {
    const { orders, counter } = createInitialOrders(INITIAL_ORDER_COUNT);
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
    });
  },

  addIngredient: (ingredient) => {
    const { status, currentBurger } = get();
    if (status !== 'playing') return;
    set({ currentBurger: [...currentBurger, ingredient] });
  },

  removeLastIngredient: () => {
    const { status, currentBurger } = get();
    if (status !== 'playing' || currentBurger.length === 0) return;
    set({ currentBurger: currentBurger.slice(0, -1) });
  },

  submitBurger: () => {
    const { status, orders, currentBurger, combo, maxCombo, score, hp } = get();
    if (status !== 'playing' || orders.length === 0 || currentBurger.length === 0) return;

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

    // 소비된 주문서 제거 후 새 주문서 추가
    // calcFreshSlotTime: 잔여시간이 아닌 슬롯 위치 기반 fresh 시간으로 계산
    const { orderCounter } = get();
    const remaining = orders.slice(1);
    const freshPrevTime = calcFreshSlotTime(remaining, newScore);
    const newOrder = generateOrder(orderCounter, newScore, freshPrevTime);
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
      submitFlash: 'correct',
    });
  },

  tick: (delta: number) => {
    const { status, orders, hp, score } = get();
    if (status !== 'playing') return;

    const diff = getDifficulty(score);
    let newHp = hp - diff.hpDrainPerSec * delta;
    let timedOutCount = 0;

    const updatedOrders = orders.map((order) => {
      const newElapsed = order.elapsed + delta;
      if (newElapsed >= order.timeLimit) {
        timedOutCount++;
        return null;
      }
      return { ...order, elapsed: newElapsed };
    }).filter(Boolean) as Order[];

    // 타임아웃된 주문서만큼 HP 감소 + 새 주문서 보충
    newHp += HP_DELTA.orderTimeout * timedOutCount;
    newHp = Math.max(0, newHp);

    let { orderCounter } = get();
    const replenished = [...updatedOrders];
    for (let i = 0; i < timedOutCount; i++) {
      const freshPrevTime = calcFreshSlotTime(replenished, score);
      replenished.push(generateOrder(orderCounter, score, freshPrevTime));
      orderCounter++;
    }

    // 남은 시간 오름차순 정렬 (가장 급한 주문이 항상 왼쪽)
    const sorted = replenished.sort(
      (a, b) => (a.timeLimit - a.elapsed) - (b.timeLimit - b.elapsed)
    );

    set({
      hp: newHp,
      orders: sorted,
      orderCounter,
      status: newHp <= 0 ? 'gameover' : 'playing',
      // 타임아웃 발생 시 콤보 및 쌓던 재료 초기화
      ...(timedOutCount > 0 ? { combo: 0, currentBurger: [] } : {}),
    });
  },

  saveScore: async (playerId: string) => {
    const { score, maxCombo, mode } = get();
    try {
      await upsertScore(playerId, mode, score, maxCombo);
    } catch {
      // ignore
    }
  },

  addOrdersFromAttack: (count: number) => {
    const { orders, orderCounter, score } = get();
    let counter = orderCounter;
    const newOrders = [...orders];
    for (let i = 0; i < count; i++) {
      const freshPrevTime = calcFreshSlotTime(newOrders, score);
      newOrders.push(generateOrder(counter, score, freshPrevTime));
      counter++;
    }
    const sorted = newOrders.sort(
      (a, b) => (a.timeLimit - a.elapsed) - (b.timeLimit - b.elapsed)
    );
    set({ orders: sorted, orderCounter: counter });
  },

  clearFlash: () => set({ submitFlash: null, lastSubmittedBurger: [] }),
}));
