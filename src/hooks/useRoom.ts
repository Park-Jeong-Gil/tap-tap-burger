'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
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
  isFeverActive: boolean;
  feverStackCount: number;
  status: 'playing' | 'gameover';
}

interface OpponentFeverResult {
  cycle: number;
  count: number;
}

export function useVersusRoom(
  roomId: string,
  playerId: string,
  onOpponentUpdate: (state: OpponentState) => void,
  onOpponentFeverResult?: (result: OpponentFeverResult) => void,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // playerId를 ref로 관리: 채널을 재생성하지 않고 최신값을 핸들러에서 참조
  const playerIdRef = useRef(playerId);
  const addOrdersFromAttack = useGameStore((s) => s.addOrdersFromAttack);
  const setRoomStatus = useRoomStore((s) => s.setRoomStatus);

  // playerId가 바뀌어도 채널은 유지하고 ref만 갱신
  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    if (!roomId) return;

    const channel = supabase.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    // 상대방 상태 업데이트
    channel.on('broadcast', { event: 'state_update' }, ({ payload }) => {
      const p = payload as OpponentState & { playerId: string };
      if (p.playerId !== playerIdRef.current) {
        onOpponentUpdate({
          hp: p.hp,
          queueCount: p.queueCount,
          score: p.score ?? 0,
          combo: p.combo ?? 0,
          clearedCount: p.clearedCount ?? 0,
          targetIngredients: p.targetIngredients ?? [],
          isFeverActive: p.isFeverActive ?? false,
          feverStackCount: p.feverStackCount ?? 0,
          status: p.status,
        });
      }
    });

    // 공격 이벤트 (상대 콤보 → 내 큐에 주문서 추가)
    channel.on('broadcast', { event: 'attack' }, ({ payload }) => {
      const { count, attackType, fromPlayerId } = payload as {
        count: number;
        attackType?: 'combo' | 'fever_delta';
        fromPlayerId: string;
      };
      if (fromPlayerId !== playerIdRef.current) {
        addOrdersFromAttack(count, attackType ?? 'combo');
      }
    });

    channel.on('broadcast', { event: 'fever_result' }, ({ payload }) => {
      const { playerId: fromPlayerId, cycle, count } = payload as {
        playerId: string;
        cycle: number;
        count: number;
      };
      if (fromPlayerId !== playerIdRef.current) {
        onOpponentFeverResult?.({ cycle, count });
      }
    });

    // 게임 시작 이벤트
    channel.on('broadcast', { event: 'game_start' }, () => {
      setRoomStatus('playing');
    });

    // NOTE: postgres_changes 제거 — useLobbyRoom이 rooms 상태 변경을 이미 처리함.
    // postgres_changes 필터 검증 실패 시 채널 전체가 unsubscribe되어 broadcast가 깨지는 문제 방지.

    // 채널 참조를 동기적으로 설정 (broadcast 미전송 시 REST fallback이 작동하도록)
    channelRef.current = channel;

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
      }
    });

    return () => {
      channelRef.current = null;
      setIsConnected(false);
      supabase.removeChannel(channel);
    };
  }, [roomId, onOpponentUpdate, onOpponentFeverResult, addOrdersFromAttack, setRoomStatus]); // playerId 제거 — ref로 관리

  // sendStateUpdate/sendAttack도 ref 사용 → 안정적인 함수 참조 유지
  const sendStateUpdate = useCallback((state: OpponentState) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'state_update',
      payload: { ...state, playerId: playerIdRef.current },
    });
  }, []);

  const sendAttack = useCallback((count: number, attackType: 'combo' | 'fever_delta' = 'combo') => {
    channelRef.current?.send({
      type: 'broadcast', event: 'attack',
      payload: { count, attackType, fromPlayerId: playerIdRef.current },
    });
  }, []);

  const sendFeverResult = useCallback((cycle: number, count: number) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'fever_result',
      payload: { cycle, count, playerId: playerIdRef.current },
    });
  }, []);

  return { sendStateUpdate, sendAttack, sendFeverResult, isConnected };
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
  const roomStatus = useRoomStore((s) => s.roomStatus);

  useEffect(() => {
    if (!roomId || roomStatus !== 'waiting') return;

    let polling: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      // 초기 플레이어 목록 즉시 조회
      fetchRoomPlayers(roomId).then(setPlayers);

      // 'waiting' 상태인 경우에만 폴링 시작 (이미 진행 중/종료된 방은 제외)
      // 초기 상태를 roomStatus에 세팅하지 않음 — join 로직의 만료 체크와 충돌 방지
      const room = await getRoomInfo(roomId);
      if (!room || room.status !== 'waiting') return;

      // 폴링: 2초마다 룸 상태 + 플레이어 ready 상태 확인 (postgres_changes 누락 대비)
      polling = setInterval(async () => {
        const players = await fetchRoomPlayers(roomId);
        setPlayers(players);

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
  }, [roomId, roomStatus, setPlayers, setRoomStatus]);
}
