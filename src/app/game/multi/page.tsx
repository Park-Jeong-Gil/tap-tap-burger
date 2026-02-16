'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePlayerStore } from '@/stores/playerStore';
import { useRoomStore } from '@/stores/roomStore';
import { useLobbyRoom } from '@/hooks/useRoom';
import { getRoomInfo, getRoomPlayers } from '@/lib/supabase';
import { ACTIVE_ROOM_STORAGE_KEY } from '@/lib/constants';
import type { GameMode } from '@/types';

export default function MultiHubPage() {
  const router = useRouter();
  const { playerId, nickname, initSession, isInitialized } = usePlayerStore();
  const {
    roomId,
    mode,
    isHost,
    players,
    roomStatus,
    createAndJoin,
    setReady,
    startGame,
    setRoomStatus,
    reset,
    restoreHostRoom,
  } = useRoomStore();
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode | null>(null);

  useEffect(() => { initSession(); }, [initSession]);

  // 새로고침 복원: localStorage에 활성 룸이 있으면 DB에서 상태 복원
  useEffect(() => {
    if (!isInitialized || roomId) return;
    const saved = localStorage.getItem(ACTIVE_ROOM_STORAGE_KEY);
    if (!saved) return;
    const { roomId: savedRoomId, mode } = JSON.parse(saved) as { roomId: string; mode: GameMode };
    const restore = async () => {
      const room = await getRoomInfo(savedRoomId);
      if (!room || room.status !== 'waiting') {
        localStorage.removeItem(ACTIVE_ROOM_STORAGE_KEY);
        return;
      }
      const roomPlayers = await getRoomPlayers(savedRoomId);
      restoreHostRoom(savedRoomId, mode, roomPlayers);
      setSelectedMode(mode);
    };
    restore();
  }, [isInitialized, roomId, restoreHostRoom]);

  // 방장 시작 → 게임 페이지 이동
  useEffect(() => {
    if (roomStatus === 'playing' && roomId && selectedMode) {
      router.push(`/game/${selectedMode}/${roomId}`);
    }
  }, [roomStatus, roomId, selectedMode, router]);

  // 대기실 실시간 동기화
  useLobbyRoom(roomId ?? '');

  // 뒤로가기로 대기실 페이지에 복귀했을 때도 실제 룸 상태를 즉시 반영
  useEffect(() => {
    if (!roomId) return;
    const syncRoomStatus = async () => {
      const room = await getRoomInfo(roomId);
      if (!room || room.status === 'finished') {
        setRoomStatus('finished');
      }
    };
    syncRoomStatus();
  }, [roomId, setRoomStatus]);

  const handleCreate = async (mode: GameMode) => {
    if (!playerId || !isInitialized) return;
    setCreating(true);
    try {
      const newRoomId = await createAndJoin(mode, playerId, nickname);
      setSelectedMode(mode);
      const url = `${window.location.origin}/game/${mode}/${newRoomId}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } finally {
      setCreating(false);
    }
  };

  const handleReady = async () => {
    if (!roomId || !playerId) return;
    await setReady(roomId, playerId);
  };

  const handleStart = async () => {
    if (!roomId) return;
    await startGame(roomId);
  };

  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const myEntry = players.find((p) => p.playerId === playerId);
  const myReady = myEntry?.ready ?? false;

  // 참가자로 접속한 경우 (roomId가 URL에서 왔을 때)
  // → /game/coop/[roomId] or /game/versus/[roomId] 에서 직접 처리

  if (roomId && roomStatus === 'finished') {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">게임 만료</p>
          <p style={{ fontFamily: 'Mulmaru', fontSize: '0.85em', color: '#9B7060', textAlign: 'center' }}>
            이 게임은 종료되어 더 이상 참여할 수 없습니다.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => { reset(); }}>
          확인
        </button>
      </div>
    );
  }

  if (roomId) {
    const displayMode = selectedMode ?? mode;
    const lobbyTitle =
      displayMode === 'coop'
        ? '협력 모드 대기실'
        : displayMode === 'versus'
          ? '대전 모드 대기실'
          : '멀티 모드 대기실';
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{lobbyTitle}</p>

          <div className="room-lobby__link">
            <p style={{ fontFamily: 'Mulmaru', fontSize: '0.75em', color: '#7a7a9a', flex: 1, wordBreak: 'break-all' }}>
              링크가 클립보드에 복사되었습니다. 친구에게 공유하세요.
            </p>
            {copied && <span style={{ color: '#4caf50', fontFamily: 'Mulmaru', fontSize: '0.8em' }}>✓ 복사됨</span>}
          </div>

          <div className="room-lobby__players">
            <p style={{ fontFamily: 'Mulmaru', fontSize: '0.8em', color: '#7a7a9a' }}>참가자</p>
            {players.map((p) => (
              <div key={p.playerId} className={`room-lobby__player${p.ready ? ' room-lobby__player--ready' : ''}`}>
                <span>{p.nickname} {p.playerId === playerId ? '(나)' : ''}</span>
                <span>{p.ready ? '준비 완료 ✓' : '대기 중...'}</span>
              </div>
            ))}
            {players.length < 2 && (
              <p style={{ fontFamily: 'Mulmaru', fontSize: '0.75em', color: '#7a7a9a' }}>
                상대방을 기다리는 중...
              </p>
            )}
          </div>

          {!isHost && !myReady && (
            <button className="btn btn--primary" onClick={handleReady}>준비</button>
          )}

          {isHost && (
            <button
              className="btn btn--primary"
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady ? '게임 시작' : '모든 플레이어를 기다리는 중...'}
            </button>
          )}
        </div>

        <button className="btn btn--ghost" onClick={() => { reset(); router.push('/'); }}>
          취소
        </button>
      </div>
    );
  }

  return (
    <div className="multi-hub">
      <h2 className="multi-hub__title">멀티 게임</h2>

      <div className="multi-hub__modes">
        <button
          className="btn btn--primary"
          onClick={() => handleCreate('coop')}
          disabled={creating || !isInitialized}
        >
          협력 모드
        </button>
        <button
          className="btn btn--ghost"
          onClick={() => handleCreate('versus')}
          disabled={creating || !isInitialized}
        >
          대전 모드
        </button>
      </div>

      <button className="btn btn--ghost" onClick={() => router.push('/')}>
        ← 뒤로
      </button>
    </div>
  );
}
