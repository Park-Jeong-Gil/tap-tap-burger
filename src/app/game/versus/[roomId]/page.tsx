"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useVersusRoom, useLobbyRoom } from "@/hooks/useRoom";
import { supabase } from "@/lib/supabase";
import HpBar from "@/components/game/HpBar";
import OrderQueue from "@/components/game/OrderQueue";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";

interface OpponentState {
  hp: number;
  queueCount: number;
  status: "playing" | "gameover";
  nickname?: string;
}

export default function VersusGamePage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const { playerId, nickname, initSession, isInitialized } = usePlayerStore();
  const {
    isHost,
    players,
    roomStatus,
    joinExisting,
    setReady,
    startGame,
    setRoomStatus,
  } = useRoomStore();
  const {
    status: gameStatus,
    hp,
    score,
    combo,
    orders,
    currentBurger,
    startGame: startLocalGame,
  } = useGameStore();

  const [opponent, setOpponent] = useState<OpponentState>({
    hp: 80,
    queueCount: 3,
    status: "playing",
  });
  const [joined, setJoined] = useState(false);
  const prevComboRef = useRef(0);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 룸 참가
  useEffect(() => {
    if (!isInitialized || !playerId || joined) return;
    setJoined(true);
    const join = async () => {
      const { data } = await supabase
        .from("room_players")
        .select("player_id")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();
      if (!data) await joinExisting(roomId, playerId, nickname);
    };
    join();
  }, [isInitialized, playerId, joined, roomId, nickname, joinExisting]);

  const handleOpponentUpdate = useCallback((state: OpponentState) => {
    setOpponent(state);
  }, []);

  const { sendStateUpdate, sendAttack } = useVersusRoom(
    roomId,
    playerId ?? "",
    handleOpponentUpdate,
  );
  useLobbyRoom(roomId);
  useGameLoop();
  useKeyboard({ enabled: gameStatus === "playing" });

  // 게임 시작
  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      startLocalGame("versus");
    }
  }, [roomStatus, gameStatus, startLocalGame]);

  // 내 상태 주기적으로 상대방에게 전송 + 콤보 공격
  useEffect(() => {
    if (gameStatus !== "playing") return;
    sendStateUpdate({ hp, queueCount: orders.length, status: "playing" });

    // 콤보 증가 시 공격 이벤트 전송
    if (combo > prevComboRef.current && combo > 0) {
      sendAttack(combo);
    }
    prevComboRef.current = combo;
  }, [hp, orders.length, combo, gameStatus, sendStateUpdate, sendAttack]);

  // 게임오버 시 상대방에게 알림
  useEffect(() => {
    if (gameStatus === "gameover") {
      sendStateUpdate({ hp: 0, queueCount: 0, status: "gameover" });
    }
  }, [gameStatus, sendStateUpdate]);

  const handleReady = async () => {
    if (!playerId) return;
    await setReady(roomId, playerId);
  };

  const handleStart = async () => {
    await startGame(roomId);
    setRoomStatus("playing");
  };

  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const myEntry = players.find((p) => p.playerId === playerId);
  const myReady = myEntry?.ready ?? false;
  const opponentEntry = players.find((p) => p.playerId !== playerId);

  // 대기실 화면
  if (roomStatus === "waiting") {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">대전 모드 대기실</p>
          <div className="room-lobby__players">
            {players.map((p) => (
              <div
                key={p.playerId}
                className={`room-lobby__player${p.ready ? " room-lobby__player--ready" : ""}`}
              >
                <span>
                  {p.nickname} {p.playerId === playerId ? "(나)" : ""}
                </span>
                <span>{p.ready ? "준비 완료 ✓" : "대기 중..."}</span>
              </div>
            ))}
            {players.length < 2 && (
              <p
                style={{
                  fontFamily: "Mulmaru",
                  fontSize: "0.75em",
                  color: "#7a7a9a",
                }}
              >
                상대방 대기 중...
              </p>
            )}
          </div>
          {!myReady && (
            <button className="btn btn--primary" onClick={handleReady}>
              준비
            </button>
          )}
          {isHost && (
            <button
              className="btn btn--primary"
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady ? "게임 시작" : "대기 중..."}
            </button>
          )}
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          취소
        </button>
      </div>
    );
  }

  return (
    <div
      className="ingame"
      style={{ display: "flex", flexDirection: "column" }}
    >
      {/* 상단: 상대방 미니 패널 */}
      <div className="versus-opponent">
        <span>{opponentEntry?.nickname ?? "상대방"}</span>
        <span>❤️ HP {Math.ceil(opponent.hp)}</span>
        <span>큐 {opponent.queueCount}</span>
        {opponent.status === "gameover" && (
          <span style={{ color: "#4caf50" }}>GAME OVER</span>
        )}
      </div>

      {/* 내 게임 */}
      <HpBar hp={hp} />
      <OrderQueue orders={orders} currentBurger={currentBurger} />
      <ScoreBoard score={score} combo={combo} />
      <InputPanel />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
