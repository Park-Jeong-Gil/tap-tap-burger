'use client';

import { create } from 'zustand';
import type { Ingredient, Order, GameStatus, GameMode } from '@/types';
import {
  HP_MAX,
  HP_INIT,
  HP_DELTA,
  BASE_SECONDS_PER_INGREDIENT,
  INGREDIENTS,
  MULTI_MAX_INGREDIENTS,
  ORDER_REFRESH_DELAY_MS,
  FEVER_INTERVAL_CLEARS,
  FEVER_SCORE_PER_STACK,
  FEVER_TIMEOUT_GRACE_SECONDS,
} from '@/lib/constants';
import {
  generateOrder,
  generateFeverOrder,
  validateBurger,
  isCombo,
  getClearJudgement,
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
  lastSubmittedBurger: Ingredient[];
  orderCounter: number;
  submitFlash: 'correct' | 'wrong' | null;
  lastScoreGain: number;
  lastComboOnSubmit: number;
  lastClearJudgement: 'perfect' | 'good' | 'clear' | null;
  wrongFlashCount: number;
  timeoutFlashCount: number;
  clearedCount: number;
  attackReceivedFlashCount: number;
  attackReceivedCount: number;
  attackReceivedType: 'combo' | 'fever_delta';
  inputLockedAt: number;
  mode: GameMode;

  // fever state
  isFeverActive: boolean;
  feverIngredient: Ingredient | null;
  feverEndAt: number;
  feverStackCount: number;
  pendingFeverOrder: boolean;
  nextFeverClearTarget: number;
  feverCycleCounter: number;
  lastFeverResultCount: number;
  lastFeverResultCycle: number;
  feverResultSeq: number;

  // actions
  startGame: (mode?: GameMode) => void;
  resetGame: () => void;
  addIngredient: (ingredient: Ingredient) => void;
  removeLastIngredient: () => void;
  clearBurger: () => void;
  submitBurger: () => void;
  tick: (delta: number) => void;
  saveScore: (playerId: string) => Promise<boolean>;
  addOrdersFromAttack: (count: number, attackType?: 'combo' | 'fever_delta') => void;
  forceGameOver: () => void;
  clearFlash: () => void;
}

function createInitialOrders(
  count: number,
  maxIngredients?: number,
  useSeed = false,
): { orders: Order[]; counter: number } {
  const orders: Order[] = [];
  for (let i = 0; i < count; i++) {
    orders.push(generateOrder(i, undefined, maxIngredients, useSeed ? i : undefined));
  }
  return { orders, counter: count };
}

function getActiveFeverState(orders: Order[], currentBurger: Ingredient[]) {
  const active = orders[0];
  if (!active || active.type !== 'fever') {
    return {
      isFeverActive: false,
      feverIngredient: null,
      feverEndAt: 0,
      feverStackCount: 0,
    };
  }
  return {
    isFeverActive: true,
    feverIngredient: active.feverIngredient ?? active.ingredients[0] ?? null,
    feverEndAt: Date.now() + Math.max(0, active.timeLimit - active.elapsed) * 1000,
    feverStackCount: currentBurger.length,
  };
}

function makeNextOrder(params: {
  orderCounter: number;
  pendingFeverOrder: boolean;
  feverCycleCounter: number;
  maxIngredients?: number;
  useSeed?: boolean;
}) {
  const { orderCounter, pendingFeverOrder, feverCycleCounter, maxIngredients, useSeed = false } = params;
  const seed = useSeed ? orderCounter : undefined;
  if (pendingFeverOrder) {
    return {
      order: generateFeverOrder(orderCounter, feverCycleCounter + 1, seed),
      nextOrderCounter: orderCounter + 1,
      nextPendingFeverOrder: false,
      nextFeverCycleCounter: feverCycleCounter + 1,
    };
  }

  return {
    order: generateOrder(orderCounter, undefined, maxIngredients, seed),
    nextOrderCounter: orderCounter + 1,
    nextPendingFeverOrder: false,
    nextFeverCycleCounter: feverCycleCounter,
  };
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
  lastClearJudgement: null,
  wrongFlashCount: 0,
  timeoutFlashCount: 0,
  clearedCount: 0,
  attackReceivedFlashCount: 0,
  attackReceivedCount: 0,
  attackReceivedType: 'combo',
  inputLockedAt: 0,
  mode: 'single',
  isFeverActive: false,
  feverIngredient: null,
  feverEndAt: 0,
  feverStackCount: 0,
  pendingFeverOrder: false,
  nextFeverClearTarget: FEVER_INTERVAL_CLEARS,
  feverCycleCounter: 0,
  lastFeverResultCount: 0,
  lastFeverResultCycle: 0,
  feverResultSeq: 0,

  startGame: (mode = 'single') => {
    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    const { orders, counter } = createInitialOrders(INITIAL_ORDER_COUNT, maxIng, mode === 'coop');
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
      lastClearJudgement: null,
      wrongFlashCount: 0,
      timeoutFlashCount: 0,
      clearedCount: 0,
      attackReceivedFlashCount: 0,
      attackReceivedCount: 0,
      attackReceivedType: 'combo',
      inputLockedAt: 0,
      mode,
      isFeverActive: false,
      feverIngredient: null,
      feverEndAt: 0,
      feverStackCount: 0,
      pendingFeverOrder: false,
      nextFeverClearTarget: FEVER_INTERVAL_CLEARS,
      feverCycleCounter: 0,
      lastFeverResultCount: 0,
      lastFeverResultCycle: 0,
      feverResultSeq: 0,
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
      lastClearJudgement: null,
      wrongFlashCount: 0,
      timeoutFlashCount: 0,
      clearedCount: 0,
      attackReceivedFlashCount: 0,
      attackReceivedCount: 0,
      attackReceivedType: 'combo',
      inputLockedAt: 0,
      isFeverActive: false,
      feverIngredient: null,
      feverEndAt: 0,
      feverStackCount: 0,
      pendingFeverOrder: false,
      nextFeverClearTarget: FEVER_INTERVAL_CLEARS,
      feverCycleCounter: 0,
      lastFeverResultCount: 0,
      lastFeverResultCycle: 0,
      feverResultSeq: 0,
    });
  },

  addIngredient: (ingredient) => {
    const { status, currentBurger, inputLockedAt, isFeverActive, feverIngredient } = get();
    if (status !== 'playing') return;
    if (inputLockedAt > 0 && Date.now() - inputLockedAt < ORDER_REFRESH_DELAY_MS) return;
    if (isFeverActive && feverIngredient && ingredient !== feverIngredient) return;

    const nextBurger = [...currentBurger, ingredient];
    set({
      currentBurger: nextBurger,
      ...(isFeverActive ? { feverStackCount: nextBurger.length } : {}),
    });
  },

  removeLastIngredient: () => {
    const { status, currentBurger, isFeverActive } = get();
    if (status !== 'playing' || currentBurger.length === 0) return;
    if (isFeverActive) return;
    set({ currentBurger: currentBurger.slice(0, -1) });
  },

  clearBurger: () => {
    const { status, currentBurger, isFeverActive } = get();
    if (status !== 'playing' || currentBurger.length === 0) return;
    if (isFeverActive) return;
    set({ currentBurger: [] });
  },

  submitBurger: () => {
    const {
      status,
      orders,
      currentBurger,
      combo,
      maxCombo,
      score,
      hp,
      inputLockedAt,
      orderCounter,
      mode,
      clearedCount,
      pendingFeverOrder,
      nextFeverClearTarget,
      feverCycleCounter,
      feverResultSeq,
    } = get();

    if (status !== 'playing' || orders.length === 0 || currentBurger.length === 0) return;
    if (inputLockedAt > 0 && Date.now() - inputLockedAt < ORDER_REFRESH_DELAY_MS) return;

    const targetOrder = orders[0];
    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    const useSeed = mode === 'coop';

    if (targetOrder.type === 'fever') {
      const feverStack = currentBurger.length;
      const points = feverStack * FEVER_SCORE_PER_STACK;
      const remaining = orders.slice(1);
      const next = makeNextOrder({
        orderCounter,
        pendingFeverOrder,
        feverCycleCounter,
        maxIngredients: maxIng,
        useSeed,
      });
      const newOrders = [...remaining, next.order];
      const feverState = getActiveFeverState(newOrders, []);
      const feverCycle = targetOrder.feverCycle ?? feverCycleCounter;

      set({
        score: score + points,
        orders: newOrders,
        currentBurger: [],
        lastSubmittedBurger: [...currentBurger],
        orderCounter: next.nextOrderCounter,
        clearedCount: clearedCount + 1,
        submitFlash: 'correct',
        lastScoreGain: points,
        lastComboOnSubmit: 0,
        lastClearJudgement: 'perfect',
        inputLockedAt: Date.now(),
        pendingFeverOrder: next.nextPendingFeverOrder,
        nextFeverClearTarget,
        feverCycleCounter: next.nextFeverCycleCounter,
        lastFeverResultCount: feverStack,
        lastFeverResultCycle: feverCycle,
        feverResultSeq: feverResultSeq + 1,
        ...feverState,
      });
      return;
    }

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
        lastClearJudgement: null,
      });
      return;
    }

    const wasCombo = isCombo(targetOrder.elapsed, targetOrder.timeLimit);
    const clearJudgement = getClearJudgement(targetOrder.elapsed, targetOrder.timeLimit);
    const newCombo = wasCombo ? combo + 1 : 0;
    const points = calcScore(newCombo);
    const newScore = score + points;
    const newMaxCombo = Math.max(maxCombo, newCombo);
    const hpDelta = wasCombo ? HP_DELTA.comboSubmit : HP_DELTA.correctSubmit;
    const newHp = Math.min(HP_MAX, hp + hpDelta);
    const newClearedCount = clearedCount + 1;

    let nextPendingFeverOrder = pendingFeverOrder;
    let nextFeverTarget = nextFeverClearTarget;
    if (newClearedCount >= nextFeverTarget) {
      nextPendingFeverOrder = true;
      nextFeverTarget += FEVER_INTERVAL_CLEARS;
    }

    const remaining = orders.slice(1);
    const next = makeNextOrder({
      orderCounter,
      pendingFeverOrder: nextPendingFeverOrder,
      feverCycleCounter,
      maxIngredients: maxIng,
      useSeed,
    });
    const newOrders = [...remaining, next.order];
    const feverState = getActiveFeverState(newOrders, []);

    set({
      hp: newHp,
      score: newScore,
      combo: newCombo,
      maxCombo: newMaxCombo,
      orders: newOrders,
      currentBurger: [],
      lastSubmittedBurger: [...currentBurger],
      orderCounter: next.nextOrderCounter,
      clearedCount: newClearedCount,
      submitFlash: 'correct',
      lastScoreGain: points,
      lastComboOnSubmit: wasCombo ? newCombo : 0,
      lastClearJudgement: clearJudgement,
      inputLockedAt: Date.now(),
      pendingFeverOrder: next.nextPendingFeverOrder,
      nextFeverClearTarget: nextFeverTarget,
      feverCycleCounter: next.nextFeverCycleCounter,
      ...feverState,
    });
  },

  tick: (delta: number) => {
    const {
      status,
      orders,
      hp,
      timeoutFlashCount,
      mode,
      orderCounter: startCounter,
      pendingFeverOrder: startPendingFever,
      feverCycleCounter: startFeverCycle,
      currentBurger,
      feverResultSeq,
      inputLockedAt,
    } = get();

    if (status !== 'playing' || orders.length === 0) return;

    let orderCounter = startCounter;
    let pendingFeverOrder = startPendingFever;
    let feverCycleCounter = startFeverCycle;

    const diff = getDifficulty(orderCounter);
    let newHp = hp - diff.hpDrainPerSec * delta;

    const active = orders[0];
    const isOrderRefreshDelay =
      inputLockedAt > 0 && Date.now() - inputLockedAt < ORDER_REFRESH_DELAY_MS;
    const elapsedDelta = isOrderRefreshDelay ? 0 : delta;
    const newElapsed = active.elapsed + elapsedDelta;
    const timeoutLimit =
      active.type === 'fever'
        ? active.timeLimit + FEVER_TIMEOUT_GRACE_SECONDS
        : active.timeLimit;
    const timedOut = newElapsed > timeoutLimit;

    let queueOrders: Order[];
    if (timedOut) {
      queueOrders = orders.slice(1);
      if (active.type === 'normal') {
        newHp += HP_DELTA.orderTimeout;
      }
    } else {
      queueOrders = [{ ...active, elapsed: newElapsed }, ...orders.slice(1)];
    }

    newHp = Math.max(0, newHp);

    const maxIng = mode !== 'single' ? MULTI_MAX_INGREDIENTS : undefined;
    const useSeed = mode === 'coop';
    if (timedOut) {
      const next = makeNextOrder({
        orderCounter,
        pendingFeverOrder,
        feverCycleCounter,
        maxIngredients: maxIng,
        useSeed,
      });
      queueOrders.push(next.order);
      orderCounter = next.nextOrderCounter;
      pendingFeverOrder = next.nextPendingFeverOrder;
      feverCycleCounter = next.nextFeverCycleCounter;
    }

    const isFeverTimeout = timedOut && active.type === 'fever';
    const nextBurger = timedOut ? [] : currentBurger;
    const feverState = getActiveFeverState(queueOrders, nextBurger);

    set({
      hp: newHp,
      orders: queueOrders,
      orderCounter,
      pendingFeverOrder,
      feverCycleCounter,
      status: newHp <= 0 ? 'gameover' : 'playing',
      ...(timedOut
        ? active.type === 'normal'
          ? {
              combo: 0,
              currentBurger: [],
              timeoutFlashCount: timeoutFlashCount + 1,
              inputLockedAt: Date.now(),
              lastClearJudgement: null,
            }
          : {
              currentBurger: [],
              inputLockedAt: Date.now(),
            }
        : {}),
      ...(isFeverTimeout
        ? {
            lastFeverResultCount: 0,
            lastFeverResultCycle: active.feverCycle ?? feverCycleCounter,
            feverResultSeq: feverResultSeq + 1,
          }
        : {}),
      ...feverState,
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

  addOrdersFromAttack: (count: number, attackType: 'combo' | 'fever_delta' = 'combo') => {
    const { orders, orderCounter } = get();
    if (orders.length === 0 || count <= 0) return;

    const lastNormalIdx = [...orders].reverse().findIndex((o) => o.type === 'normal');
    if (lastNormalIdx < 0) return;
    const idx = orders.length - 1 - lastNormalIdx;
    const target = orders[idx];

    const extra: Ingredient[] = Array.from({ length: count }, () =>
      INGREDIENTS[Math.floor(Math.random() * INGREDIENTS.length)],
    );
    const extraTime = count * BASE_SECONDS_PER_INGREDIENT * getDifficulty(orderCounter).timerMultiplier;

    const newOrders = [...orders];
    newOrders[idx] = {
      ...target,
      ingredients: [...target.ingredients, ...extra],
      timeLimit: target.timeLimit + extraTime,
    };

    set({
      orders: newOrders,
      attackReceivedFlashCount: get().attackReceivedFlashCount + 1,
      attackReceivedCount: count,
      attackReceivedType: attackType,
    });
  },

  forceGameOver: () => {
    if (get().status === 'playing') set({ status: 'gameover' });
  },

  clearFlash: () => set({
    submitFlash: null,
    lastSubmittedBurger: [],
    lastScoreGain: 0,
    lastComboOnSubmit: 0,
    lastClearJudgement: null,
  }),
}));
