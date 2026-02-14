"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useCoopRoom, useLobbyRoom } from "@/hooks/useRoom";
import { supabase, getRoomInfo, updateRoomStatus } from "@/lib/supabase";
import { assignCoopKeys } from "@/lib/gameLogic";
import { KEY_MAP, NICKNAME_STORAGE_KEY } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import CountdownScreen from "@/components/game/CountdownScreen";
import type { Ingredient } from "@/types";

export default function CoopGamePage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const { playerId, nickname, setNickname, saveNickname, initSession, isInitialized } = usePlayerStore();
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
    startGame: startLocalGame,
    addIngredient,
    removeLastIngredient,
    submitBurger,
  } = useGameStore();

  const [assignedKeys, setAssignedKeys] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countingDown, setCountingDown] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 닉네임 입력 초기화 (저장된 값 or 현재 닉네임)
  useEffect(() => {
    if (!isInitialized) return;
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    setNicknameInput(saved ?? nickname);
  }, [isInitialized, nickname]);

  // 룸 참가
  useEffect(() => {
    if (!isInitialized || !playerId || joined) return;
    setJoined(true);

    const join = async () => {
      // 룸 상태 확인
      const room = await getRoomInfo(roomId);
      if (!room || room.status === "finished") {
        setExpired(true);
        return;
      }

      // 이미 방에 있는지 확인 (방장은 createAndJoin에서 처리)
      const { data } = await supabase
        .from("room_players")
        .select("player_id, ready, assigned_keys")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (!data) {
        // 새 플레이어: 방이 진행 중이면 만료 처리
        if (room.status === "playing") {
          setExpired(true);
          return;
        }
        await joinExisting(roomId, playerId, nickname);
      }
      // data가 있으면 (대기실 참여자) 게임 시작 후에도 그대로 입장

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
        // roomId를 시드로 두 플레이어가 동일한 분할 계산
        const [keys1, keys2] = assignCoopKeys(roomId);
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

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startLocalGame("coop");
  }, [startLocalGame]);

  // 게임 시작 시 카운트다운 → 로컬 게임 시작
  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      setCountingDown(true);
    }
  }, [roomStatus, gameStatus]);

  // 게임 오버 시 룸 만료 처리 (링크 재사용 방지)
  useEffect(() => {
    if (gameStatus === "gameover") {
      updateRoomStatus(roomId, "finished").catch(() => {});
    }
  }, [gameStatus, roomId]);

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
    const trimmed = nicknameInput.trim();
    if (trimmed && trimmed !== nickname) {
      setNickname(trimmed);
      await saveNickname();
    }
    await setReady(roomId, playerId);
  };

  const handleStart = async () => {
    await startGame(roomId);
    setRoomStatus("playing");
  };

  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const myEntry = players.find((p) => p.playerId === playerId);
  const myReady = myEntry?.ready ?? false;

  // 만료된 링크 화면
  if (expired) {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">링크 만료</p>
          <p style={{ fontFamily: "Mulmaru", fontSize: "0.85em", color: "#9B7060", textAlign: "center" }}>
            이 게임 링크는 이미 사용되었거나 만료되었습니다.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          메인으로
        </button>
      </div>
    );
  }

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
          {!isHost && !myReady && (
            <>
              <div className="main-nickname" style={{ width: "100%" }}>
                <label className="main-nickname__label" htmlFor="coop-nickname">닉네임</label>
                <input
                  id="coop-nickname"
                  className="input"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nicknameInput.trim() && handleReady()}
                  placeholder="닉네임 입력..."
                  maxLength={20}
                  autoFocus
                />
              </div>
              <button
                className="btn btn--primary"
                onClick={handleReady}
                disabled={!nicknameInput.trim()}
              >
                준비
              </button>
            </>
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
      {countingDown && <CountdownScreen onComplete={handleCountdownComplete} />}
      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} combo={combo} />
      </div>
      <InputPanel allowedActions={assignedKeys} />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
