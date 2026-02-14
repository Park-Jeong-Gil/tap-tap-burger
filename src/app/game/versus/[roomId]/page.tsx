"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useVersusRoom, useLobbyRoom } from "@/hooks/useRoom";
import { supabase, getRoomInfo, updateRoomStatus } from "@/lib/supabase";
import { NICKNAME_STORAGE_KEY } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import OrderQueue from "@/components/game/OrderQueue";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";

interface OpponentState {
  hp: number;
  queueCount: number;
  score: number;
  combo: number;
  clearedCount: number;
  status: "playing" | "gameover";
  nickname?: string;
}

export default function VersusGamePage() {
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
    orders,
    currentBurger,
    clearedCount,
    startGame: startLocalGame,
  } = useGameStore();

  const [opponent, setOpponent] = useState<OpponentState>({
    hp: 80,
    queueCount: 3,
    score: 0,
    combo: 0,
    clearedCount: 0,
    status: "playing",
  });
  const [joined, setJoined] = useState(false);
  const [expired, setExpired] = useState(false);
  const [nicknameReady, setNicknameReady] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const prevComboRef = useRef(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // 저장된 닉네임이 있으면 입력 화면 스킵
  useEffect(() => {
    if (!isInitialized) return;
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    if (saved) {
      setNicknameReady(true);
    } else {
      setNicknameInput(nickname);
    }
  }, [isInitialized, nickname]);

  const handleNicknameEnter = async () => {
    const trimmed = nicknameInput.trim();
    if (!trimmed) return;
    setNickname(trimmed);
    await saveNickname();
    setNicknameReady(true);
  };

  // 룸 참가
  useEffect(() => {
    if (!isInitialized || !playerId || !nicknameReady || joined) return;
    setJoined(true);
    const join = async () => {
      // 룸 상태 확인
      const room = await getRoomInfo(roomId);
      if (!room || room.status === "finished") {
        setExpired(true);
        return;
      }

      // 이미 참여 중인지 확인
      const { data: myRow } = await supabase
        .from("room_players")
        .select("player_id")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (myRow) return; // 이미 참여 중

      // 플레이어 수 확인 (최대 2명)
      const { count } = await supabase
        .from("room_players")
        .select("player_id", { count: "exact", head: true })
        .eq("room_id", roomId);

      if (count !== null && count >= 2) {
        setExpired(true);
        return;
      }

      await joinExisting(roomId, playerId, nickname);
    };
    join();
  }, [isInitialized, playerId, nicknameReady, joined, roomId, nickname, joinExisting]);

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
    sendStateUpdate({
      hp,
      queueCount: orders.length,
      score,
      combo,
      clearedCount,
      status: "playing",
    });

    // 콤보 종료 시 (0으로 리셋) 직전 콤보 수만큼 공격
    if (combo === 0 && prevComboRef.current > 0) {
      sendAttack(prevComboRef.current);
    }
    prevComboRef.current = combo;
  }, [hp, orders.length, combo, gameStatus, sendStateUpdate, sendAttack]);

  // 게임오버 시 상대방에게 알림 + 룸 만료 처리
  useEffect(() => {
    if (gameStatus === "gameover") {
      sendStateUpdate({ hp: 0, queueCount: 0, score, combo, clearedCount, status: "gameover" });
      if (!finishedRef.current) {
        finishedRef.current = true;
        updateRoomStatus(roomId, "finished").catch(() => {});
      }
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

  // 닉네임 입력 화면 (저장된 닉네임 없는 신규 유저)
  if (isInitialized && !nicknameReady) {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">대전 입장</p>
          <div className="main-nickname" style={{ width: "100%" }}>
            <label className="main-nickname__label" htmlFor="vs-nickname">닉네임</label>
            <input
              id="vs-nickname"
              className="input"
              value={nicknameInput}
              onChange={(e) => setNicknameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNicknameEnter()}
              placeholder="닉네임 입력..."
              maxLength={20}
              autoFocus
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleNicknameEnter}
            disabled={!nicknameInput.trim()}
          >
            입장
          </button>
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          취소
        </button>
      </div>
    );
  }

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
          {!isHost && !myReady && (
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
              {allReady
                ? "게임 시작"
                : players.length < 2
                  ? "모든 플레이어를 기다리는 중..."
                  : "상대방이 준비를 누르면 시작할 수 있어요"}
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
        <span className="versus-opponent__name">
          {opponentEntry?.nickname ?? "상대방"}
        </span>
        <span className="versus-opponent__hp">HP {Math.ceil(opponent.hp)}</span>
        <span className="versus-opponent__cleared">
          ✓ {opponent.clearedCount}
        </span>
        <span className="versus-opponent__score">
          {opponent.score.toLocaleString()}
        </span>
        {opponent.status === "gameover" ? (
          <span className="versus-opponent__gameover">GAME OVER</span>
        ) : opponent.combo >= 2 ? (
          <span className="versus-opponent__combo">
            {opponent.combo}x COMBO
          </span>
        ) : null}
      </div>

      {/* 내 게임 */}
      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} combo={combo} />
      </div>
      <OrderQueue orders={orders} currentBurger={currentBurger} />
      <InputPanel />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
