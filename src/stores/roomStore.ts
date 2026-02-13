'use client';

import { create } from 'zustand';
import type { GameMode, RoomPlayer } from '@/types';
import { createRoom, joinRoom, setPlayerReady, updateRoomStatus } from '@/lib/supabase';

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
    set({
      roomId: room.id,
      mode: room.mode,
      isHost: true,
      players: [{ playerId, nickname, ready: false }],
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
    set({ roomStatus: 'playing' });
  },

  setPlayers: (players) => set({ players }),

  setRoomStatus: (status) => set({ roomStatus: status }),

  reset: () => set({
    roomId: null, mode: null, isHost: false,
    players: [], roomStatus: 'waiting',
  }),
}));
