export type Ingredient = 'patty' | 'cheese' | 'veggie' | 'sauce' | 'onion' | 'tomato';
export type GameMode = 'single' | 'coop' | 'versus';
export type GameStatus = 'idle' | 'playing' | 'gameover';
export type OrderType = 'normal' | 'fever';

export interface Order {
  id: string;
  type: OrderType;
  ingredients: Ingredient[];
  timeLimit: number;   // seconds
  elapsed: number;     // seconds elapsed
  orderIndex: number;  // cumulative order count for timer formula
  feverIngredient?: Ingredient;
  feverCycle?: number;
}

export interface Player {
  id: string;
  sessionId: string;
  nickname: string;
}

export interface RoomPlayer {
  playerId: string;
  nickname: string;
  ready: boolean;
  assignedKeys?: string[]; // coop: 3 keys assigned
}

export interface Room {
  id: string;
  mode: GameMode;
  status: 'waiting' | 'playing' | 'finished';
}

export interface ScoreRecord {
  id: string;
  playerId: string;
  nickname: string;
  mode: GameMode;
  score: number;
  maxCombo: number;
  createdAt: string;
}

export interface DifficultyTier {
  minIngredients: number;
  timerMultiplier: number;
  hpDrainPerSec: number;
}
