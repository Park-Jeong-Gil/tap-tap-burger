'use client';

import { create } from 'zustand';
import type { GameMode, RoomPlayer } from '@/types';
import { createRoom, joinRoom, setPlayerReady, updateRoomStatus } from '@/lib/supabase';
import { ACTIVE_ROOM_STORAGE_KEY } from '@/lib/constants';

interface RoomState {
  roomId: string | null;
  mode: GameMode | null;
  isHost: boolean;
  players: RoomPlayer[];
  roomStatus: 'waiting' | 'playing' | 'finished';

  createAndJoin: (mode: GameMode, playerId: string, nickname: string) => Promise<string>;
  joinExisting: (roomId: string, playerId: string, nickname: string) => Promise<void>;
  setReady: (roomId: string, playerId: string) => Promise<void>;
  startGame: (roomId: string) => Promise<void>;
  setPlayers: (players: RoomPlayer[]) => void;
  setRoomStatus: (status: 'waiting' | 'playing' | 'finished') => void;
  restoreHostRoom: (roomId: string, mode: GameMode, players: RoomPlayer[]) => void;
  reset: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  mode: null,
  isHost: false,
  players: [],
  roomStatus: 'waiting',

  createAndJoin: async (mode, playerId, nickname) => {
    const room = await createRoom(mode, playerId);
    // 게임 생성자는 즉시 준비 완료 처리
    await setPlayerReady(room.id, playerId, true);
    // 새로고침 복원을 위해 localStorage에 저장
    if (typeof window !== 'undefined') {
      localStorage.setItem(ACTIVE_ROOM_STORAGE_KEY, JSON.stringify({ roomId: room.id, mode: room.mode }));
    }
    set({
      roomId: room.id,
      mode: room.mode,
      isHost: true,
      players: [{ playerId, nickname, ready: true }],
      roomStatus: 'waiting',
    });
    return room.id;
  },

  joinExisting: async (roomId, playerId, nickname) => {
    await joinRoom(roomId, playerId);
    set((state) => ({
      roomId,
      isHost: false,
      players: [...state.players, { playerId, nickname, ready: false }],
      roomStatus: 'waiting',
    }));
  },

  setReady: async (roomId, playerId) => {
    await setPlayerReady(roomId, playerId, true);
    set((state) => ({
      players: state.players.map((p) =>
        p.playerId === playerId ? { ...p, ready: true } : p
      ),
    }));
  },

  startGame: async (roomId) => {
    await updateRoomStatus(roomId, 'playing');
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    }
    set({ roomStatus: 'playing' });
  },

  setPlayers: (players) => set({ players }),

  setRoomStatus: (status) => set({ roomStatus: status }),

  restoreHostRoom: (roomId, mode, players) => {
    set({ roomId, mode, isHost: true, players, roomStatus: 'waiting' });
  },

  reset: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
    }
    set({ roomId: null, mode: null, isHost: false, players: [], roomStatus: 'waiting' });
  },
}));
