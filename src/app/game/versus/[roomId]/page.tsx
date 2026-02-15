"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useVersusRoom, useLobbyRoom } from "@/hooks/useRoom";
import { supabase, getRoomInfo, updateRoomStatus, markRoomFinishedBeacon } from "@/lib/supabase";
import { NICKNAME_STORAGE_KEY } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import CountdownScreen from "@/components/game/CountdownScreen";
import ComboPopup from "@/components/game/ComboPopup";
import AttackSentBanner from "@/components/game/AttackSentBanner";
import AttackReceivedOverlay from "@/components/game/AttackReceivedOverlay";

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
    clearedCount,
    startGame: startLocalGame,
  } = useGameStore();

  const attackReceivedFlashCount = useGameStore((s) => s.attackReceivedFlashCount);

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
  const [countingDown, setCountingDown] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [attackSent, setAttackSent] = useState<{ id: number; count: number } | null>(null);
  const [attackShaking, setAttackShaking] = useState(false);
  const attackSentIdRef = useRef(0);
  const attackSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackShakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevComboRef = useRef(0);
  const finishedRef = useRef(false);
  const gameStatusRef = useRef(gameStatus);
  gameStatusRef.current = gameStatus;

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

      // 이미 참여 중인지 확인 (대기실에 있던 플레이어는 게임 시작 후에도 입장 허용)
      const { data: myRow } = await supabase
        .from("room_players")
        .select("player_id")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (myRow) return; // 대기실 참여자 → 그대로 입장

      // 새 플레이어: 방이 진행 중이거나 가득 찼으면 만료
      if (room.status === "playing") {
        setExpired(true);
        return;
      }

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

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startLocalGame("versus");
  }, [startLocalGame]);

  // 게임 시작 시 카운트다운 → 로컬 게임 시작
  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      setCountingDown(true);
    }
  }, [roomStatus, gameStatus]);

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
      // 공격 발사 UI 피드백
      if (attackSentTimer.current) clearTimeout(attackSentTimer.current);
      attackSentIdRef.current++;
      setAttackSent({ id: attackSentIdRef.current, count: prevComboRef.current });
      attackSentTimer.current = setTimeout(() => setAttackSent(null), 1300);
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

  // 공격 받기 → 화면 강한 흔들림
  useEffect(() => {
    if (attackReceivedFlashCount === 0) return;
    if (attackShakeTimer.current) clearTimeout(attackShakeTimer.current);
    setAttackShaking(true);
    attackShakeTimer.current = setTimeout(() => setAttackShaking(false), 620);
  }, [attackReceivedFlashCount]);

  // 게임 중 나가기 (탭 닫기 / 언마운트) → 마지막 플레이어면 룸 만료
  useEffect(() => {
    const markFinished = () => {
      if (gameStatusRef.current === "playing" && !finishedRef.current) {
        finishedRef.current = true;
        markRoomFinishedBeacon(roomId);
      }
    };
    window.addEventListener("beforeunload", markFinished);
    return () => {
      window.removeEventListener("beforeunload", markFinished);
      markFinished(); // 컴포넌트 언마운트 (SPA 이동) 시에도 실행
    };
  }, [roomId]);

  // 대기실 10분 타임아웃 → 자동 만료
  useEffect(() => {
    if (roomStatus !== "waiting") return;
    const timer = setTimeout(async () => {
      await updateRoomStatus(roomId, "finished").catch(() => {});
      setExpired(true);
    }, 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [roomId, roomStatus]);

  // 상대방이 만료 처리한 경우 (게임 미시작 상태) → 만료 화면
  useEffect(() => {
    if (roomStatus === "finished" && gameStatus === "idle" && !countingDown) {
      setExpired(true);
    }
  }, [roomStatus, gameStatus, countingDown]);

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
  const opponentEntry = players.find((p) => p.playerId !== playerId);

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
            <>
              <div className="main-nickname" style={{ width: "100%" }}>
                <label className="main-nickname__label" htmlFor="vs-nickname">닉네임</label>
                <input
                  id="vs-nickname"
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
      className={`ingame${attackShaking ? " ingame--attack-shake" : ""}`}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {countingDown && <CountdownScreen onComplete={handleCountdownComplete} />}
      <ComboPopup />
      <AttackSentBanner attackInfo={attackSent} />
      <AttackReceivedOverlay />
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
      <InputPanel />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
