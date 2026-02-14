'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useRoomStore } from '@/stores/roomStore';
import { useGameStore } from '@/stores/gameStore';
import type { Ingredient } from '@/types';

// ─── 코업 모드 ──────────────────────────────────────
export function useCoopRoom(roomId: string, playerId: string) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addIngredient = useGameStore((s) => s.addIngredient);
  const removeLastIngredient = useGameStore((s) => s.removeLastIngredient);
  const submitBurger = useGameStore((s) => s.submitBurger);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  const broadcast = useCallback((type: string, payload: Record<string, unknown>) => {
    channelRef.current?.send({ type: 'broadcast', event: type, payload });
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // 상대방의 입력 이벤트 수신
    channel.on('broadcast', { event: 'input' }, ({ payload }) => {
      const { action } = payload as { action: string };
      if (action === 'cancel') removeLastIngredient();
      else if (action === 'submit') submitBurger();
      else addIngredient(action as Ingredient);
    });

    // 게임 시작 이벤트
    channel.on('broadcast', { event: 'game_start' }, () => {
      setRoomStatus('playing');
    });

    // DB 변경 수신 (room status)
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, ({ new: row }) => {
      if (row.status === 'playing') setRoomStatus('playing');
      if (row.status === 'finished') setRoomStatus('finished');
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, addIngredient, removeLastIngredient, submitBurger, setRoomStatus]);

  // 내 입력을 상대방에게 브로드캐스트
  const sendInput = useCallback((action: string) => {
    broadcast('input', { action, playerId });
  }, [broadcast, playerId]);

  return { sendInput };
}

// ─── 대전 모드 ──────────────────────────────────────
interface OpponentState {
  hp: number;
  queueCount: number;
  score: number;
  combo: number;
  clearedCount: number;
  status: 'playing' | 'gameover';
}

export function useVersusRoom(
  roomId: string,
  playerId: string,
  onOpponentUpdate: (state: OpponentState) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const addOrdersFromAttack = useGameStore((s) => s.addOrdersFromAttack);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // 상대방 상태 업데이트
    channel.on('broadcast', { event: 'state_update' }, ({ payload }) => {
      const p = payload as OpponentState & { playerId: string };
      if (p.playerId !== playerId) {
        onOpponentUpdate({
          hp: p.hp,
          queueCount: p.queueCount,
          score: p.score ?? 0,
          combo: p.combo ?? 0,
          clearedCount: p.clearedCount ?? 0,
          status: p.status,
        });
      }
    });

    // 공격 이벤트 (상대 콤보 → 내 큐에 주문서 추가)
    channel.on('broadcast', { event: 'attack' }, ({ payload }) => {
      const { count, fromPlayerId } = payload as { count: number; fromPlayerId: string };
      if (fromPlayerId !== playerId) {
        addOrdersFromAttack(count);
      }
    });

    // 게임 시작 이벤트
    channel.on('broadcast', { event: 'game_start' }, () => {
      setRoomStatus('playing');
    });

    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, ({ new: row }) => {
      if (row.status === 'playing') setRoomStatus('playing');
      if (row.status === 'finished') setRoomStatus('finished');
    });

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, playerId, onOpponentUpdate, addOrdersFromAttack, setRoomStatus]);

  const sendStateUpdate = useCallback((state: OpponentState) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'state_update',
      payload: { ...state, playerId },
    });
  }, [playerId]);

  const sendAttack = useCallback((count: number) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'attack',
      payload: { count, fromPlayerId: playerId },
    });
  }, [playerId]);

  return { sendStateUpdate, sendAttack };
}

// ─── 대기실 실시간 동기화 ──────────────────────────
export function useLobbyRoom(roomId: string) {
  const setPlayers = useRoomStore((s) => s.setPlayers);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`lobby:${roomId}`);

    // room_players 변경 감지
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_players',
      filter: `room_id=eq.${roomId}`,
    }, async () => {
      // 최신 플레이어 목록 재조회
      const { data } = await supabase
        .from('room_players')
        .select('player_id, ready, players(nickname)')
        .eq('room_id', roomId);

      if (data) {
        setPlayers(data.map((rp) => ({
          playerId: rp.player_id,
          nickname: (rp.players as unknown as { nickname: string }[] | null)?.[0]?.nickname ?? '...',
          ready: rp.ready,
        })));
      }
    });

    // rooms status 변경 감지
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, ({ new: row }) => {
      setRoomStatus(row.status as 'waiting' | 'playing' | 'finished');
    });

    channel.subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, setPlayers, setRoomStatus]);
}
