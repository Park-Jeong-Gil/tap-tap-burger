export type Ingredient = 'patty' | 'cheese' | 'veggie' | 'sauce';
export type GameMode = 'single' | 'coop' | 'versus';
export type GameStatus = 'idle' | 'playing' | 'gameover';

export interface Order {
  id: string;
  ingredients: Ingredient[];
  timeLimit: number;   // seconds
  elapsed: number;     // seconds elapsed
  orderIndex: number;  // cumulative order count for timer formula
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
