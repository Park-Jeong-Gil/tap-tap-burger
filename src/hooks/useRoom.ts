'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase, getRoomInfo } from '@/lib/supabase';
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
  targetIngredients: Ingredient[]; // 상대방이 현재 완성해야 할 주문서의 목표 재료
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
          targetIngredients: p.targetIngredients ?? [],
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

  const sendStateUpdate = useCallback((state: Omit<OpponentState, 'nickname'>) => {
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
async function fetchRoomPlayers(roomId: string) {
  const { data } = await supabase
    .from('room_players')
    .select('player_id, ready, players(nickname)')
    .eq('room_id', roomId);
  return (data ?? []).map((rp) => ({
    playerId: rp.player_id as string,
    nickname: (rp.players as unknown as { nickname: string } | null)?.nickname ?? '...',
    ready: rp.ready as boolean,
  }));
}

export function useLobbyRoom(roomId: string) {
  const setPlayers = useRoomStore((s) => s.setPlayers);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  useEffect(() => {
    if (!roomId) return;

    let polling: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      // 초기 플레이어 목록 즉시 조회
      fetchRoomPlayers(roomId).then(setPlayers);

      // 'waiting' 상태인 경우에만 폴링 시작 (이미 진행 중/종료된 방은 제외)
      // 초기 상태를 roomStatus에 세팅하지 않음 — join 로직의 만료 체크와 충돌 방지
      const room = await getRoomInfo(roomId);
      if (!room || room.status !== 'waiting') return;

      // 폴링: 2초마다 룸 상태 확인 (postgres_changes 누락 대비)
      polling = setInterval(async () => {
        const r = await getRoomInfo(roomId);
        if (r?.status && r.status !== 'waiting') {
          setRoomStatus(r.status as 'waiting' | 'playing' | 'finished');
          if (polling) { clearInterval(polling); polling = null; }
        }
      }, 2000);
    };

    init();

    const channel = supabase.channel(`lobby:${roomId}`);

    // room_players 변경 감지
    channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_players',
      filter: `room_id=eq.${roomId}`,
    }, async () => {
      const players = await fetchRoomPlayers(roomId);
      setPlayers(players);
    });

    // rooms status 변경 감지
    channel.on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`,
    }, ({ new: row }) => {
      const status = row.status as 'waiting' | 'playing' | 'finished';
      setRoomStatus(status);
      if (status !== 'waiting' && polling) { clearInterval(polling); polling = null; }
    });

    channel.subscribe();
    return () => {
      if (polling) clearInterval(polling);
      supabase.removeChannel(channel);
    };
  }, [roomId, setPlayers, setRoomStatus]);
}
