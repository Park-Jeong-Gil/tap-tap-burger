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

  // Restore on refresh: if there's an active room in localStorage, restore state from DB
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

  // Host starts game → navigate to game page
  useEffect(() => {
    if (roomStatus === 'playing' && roomId && selectedMode) {
      router.push(`/game/${selectedMode}/${roomId}`);
    }
  }, [roomStatus, roomId, selectedMode, router]);

  // Realtime lobby sync
  useLobbyRoom(roomId ?? '');

  // Also sync room status immediately when navigating back to lobby
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

  // When joining as a participant (roomId comes from URL)
  // → handled directly in /game/coop/[roomId] or /game/versus/[roomId]

  if (roomId && roomStatus === 'finished') {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">Game Expired</p>
          <p style={{ fontFamily: 'Mulmaru', fontSize: '0.85em', color: '#9B7060', textAlign: 'center' }}>
            This game has ended and is no longer available.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => { reset(); }}>
          OK
        </button>
      </div>
    );
  }

  if (roomId) {
    const displayMode = selectedMode ?? mode;
    const lobbyTitle =
      displayMode === 'coop'
        ? 'Co-op Lobby'
        : displayMode === 'versus'
          ? 'Versus Lobby'
          : 'Multi Lobby';
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{lobbyTitle}</p>

          <div className="room-lobby__link">
            <p style={{ fontFamily: 'Mulmaru', fontSize: '0.75em', color: '#7a7a9a', flex: 1, wordBreak: 'break-all' }}>
              Link copied to clipboard. Share with a friend!
            </p>
            {copied && <span style={{ color: '#4caf50', fontFamily: 'Mulmaru', fontSize: '0.8em' }}>✓ Copied</span>}
          </div>

          <div className="room-lobby__players">
            <p style={{ fontFamily: 'Mulmaru', fontSize: '0.8em', color: '#7a7a9a' }}>Players</p>
            {players.map((p) => (
              <div key={p.playerId} className={`room-lobby__player${p.ready ? ' room-lobby__player--ready' : ''}`}>
                <span>{p.nickname} {p.playerId === playerId ? '(me)' : ''}</span>
                <span>{p.ready ? 'Ready ✓' : 'Waiting...'}</span>
              </div>
            ))}
            {players.length < 2 && (
              <p style={{ fontFamily: 'Mulmaru', fontSize: '0.75em', color: '#7a7a9a' }}>
                Waiting for opponent...
              </p>
            )}
          </div>

          {!isHost && !myReady && (
            <button className="btn btn--primary" onClick={handleReady}>Ready</button>
          )}

          {isHost && (
            <button
              className="btn btn--primary"
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady ? 'Start Game' : 'Waiting for all players...'}
            </button>
          )}
        </div>

        <button className="btn btn--ghost" onClick={() => { reset(); router.push('/'); }}>
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="multi-hub">
      <h2 className="multi-hub__title">MULTI GAME</h2>

      <div className="multi-hub__modes">
        <button
          className="btn btn--primary"
          onClick={() => handleCreate('coop')}
          disabled={creating || !isInitialized}
        >
          Co-op
        </button>
        <button
          className="btn btn--secondary"
          onClick={() => handleCreate('versus')}
          disabled={creating || !isInitialized}
        >
          Versus
        </button>
      </div>

      <button className="btn btn--ghost" onClick={() => router.push('/')}>
        ← Back
      </button>
    </div>
  );
}
