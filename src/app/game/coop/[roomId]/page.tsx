"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useCoopRoom, useLobbyRoom } from "@/hooks/useRoom";
import { supabase } from "@/lib/supabase";
import { assignCoopKeys } from "@/lib/gameLogic";
import { KEY_MAP } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import OrderQueue from "@/components/game/OrderQueue";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import type { Ingredient } from "@/types";

export default function CoopGamePage() {
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
    addIngredient,
    removeLastIngredient,
    submitBurger,
  } = useGameStore();

  const [assignedKeys, setAssignedKeys] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 룸 참가
  useEffect(() => {
    if (!isInitialized || !playerId || joined) return;
    setJoined(true);

    const join = async () => {
      // 이미 방에 있는지 확인 (방장은 createAndJoin에서 처리)
      const { data } = await supabase
        .from("room_players")
        .select("player_id, ready, assigned_keys")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (!data) {
        await joinExisting(roomId, playerId, nickname);
      }

      // 키 배분: 방장이 전체 키를 배분하고 DB에 저장
      const { data: rp } = await supabase
        .from("room_players")
        .select("assigned_keys")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .single();

      if (rp?.assigned_keys && rp.assigned_keys.length > 0) {
        setAssignedKeys(rp.assigned_keys);
      } else {
        // 첫 입장 시 키 배분
        const [keys1, keys2] = assignCoopKeys();
        const myKeys = isHost ? keys1 : keys2;
        setAssignedKeys(myKeys);
        await supabase
          .from("room_players")
          .update({ assigned_keys: myKeys })
          .eq("room_id", roomId)
          .eq("player_id", playerId);
      }
    };
    join();
  }, [isInitialized, playerId, joined, roomId, nickname, isHost, joinExisting]);

  const { sendInput } = useCoopRoom(roomId, playerId ?? "");
  useLobbyRoom(roomId);
  useGameLoop();

  // 게임 시작 시 로컬 게임 시작
  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      startLocalGame("coop");
    }
  }, [roomStatus, gameStatus, startLocalGame]);

  // 키보드 입력 → 코업 브로드캐스트
  useEffect(() => {
    if (gameStatus !== "playing" || assignedKeys.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const action = KEY_MAP[e.key];
      if (!action || !assignedKeys.includes(action)) return;

      e.preventDefault();
      if (action === "cancel") removeLastIngredient();
      else if (action === "submit") submitBurger();
      else addIngredient(action as Ingredient);

      // 상대방에게 브로드캐스트
      sendInput(action);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    gameStatus,
    assignedKeys,
    addIngredient,
    removeLastIngredient,
    submitBurger,
    sendInput,
  ]);

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

  // 대기실 화면
  if (roomStatus === "waiting") {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">협력 모드 대기실</p>
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
    <div className="ingame">
      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} combo={combo} />
      </div>
      <OrderQueue orders={orders} currentBurger={currentBurger} />
      <InputPanel allowedActions={assignedKeys} />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
