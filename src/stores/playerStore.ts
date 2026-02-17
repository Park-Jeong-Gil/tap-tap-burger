'use client';

import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import { upsertPlayer } from '@/lib/supabase';
import { SESSION_STORAGE_KEY, NICKNAME_STORAGE_KEY } from '@/lib/constants';

interface PlayerState {
  sessionId: string | null;
  playerId: string | null;
  nickname: string;
  isInitialized: boolean;

  initSession: () => Promise<void>;
  setNickname: (name: string) => void;
  saveNickname: () => Promise<void>;
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  sessionId: null,
  playerId: null,
  nickname: '',
  isInitialized: false,

  initSession: async () => {
    if (typeof window === 'undefined') return;

    let sessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
    }

    const savedNickname = localStorage.getItem(NICKNAME_STORAGE_KEY) ?? '';

    set({ sessionId, nickname: savedNickname });

    try {
      const player = await upsertPlayer(sessionId, savedNickname);
      set({ playerId: player.id, isInitialized: true });
    } catch {
      // Supabase 없이도 로컬에서 동작하도록
      set({ playerId: sessionId, isInitialized: true });
    }
  },

  setNickname: (name: string) => {
    const trimmed = name.trim();
    set({ nickname: trimmed });
    if (typeof window !== 'undefined') {
      localStorage.setItem(NICKNAME_STORAGE_KEY, trimmed);
    }
  },

  saveNickname: async () => {
    const { sessionId, nickname } = get();
    if (!sessionId) return;
    try {
      const player = await upsertPlayer(sessionId, nickname);
      set({ playerId: player.id });
    } catch {
      // ignore
    }
  },
}));
