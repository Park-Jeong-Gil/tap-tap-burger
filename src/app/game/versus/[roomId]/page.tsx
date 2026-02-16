"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useVersusRoom, useLobbyRoom } from "@/hooks/useRoom";
import {
  supabase,
  getRoomInfo,
  updateRoomStatus,
  markRoomFinishedBeacon,
} from "@/lib/supabase";
import { NICKNAME_STORAGE_KEY } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import CountdownScreen from "@/components/game/CountdownScreen";
import ComboPopup from "@/components/game/ComboPopup";
import FeverResultPopup from "@/components/game/FeverResultPopup";
import JudgementPopup from "@/components/game/JudgementPopup";
import AttackSentBanner from "@/components/game/AttackSentBanner";
import AttackReceivedOverlay from "@/components/game/AttackReceivedOverlay";
import MiniBurgerPreview from "@/components/game/MiniBurgerPreview";
import type { Ingredient } from "@/types";

interface OpponentState {
  hp: number;
  queueCount: number;
  score: number;
  combo: number;
  clearedCount: number;
  targetIngredients: Ingredient[];
  isFeverActive: boolean;
  feverStackCount: number;
  status: "playing" | "gameover";
  nickname?: string;
}

function mapFeverDiffToAttack(diff: number): number {
  if (diff >= 9) return 3;
  if (diff >= 6) return 2;
  if (diff >= 3) return 1;
  return 0;
}

export default function VersusGamePage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const {
    playerId,
    nickname,
    setNickname,
    saveNickname,
    initSession,
    isInitialized,
  } = usePlayerStore();
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
    isFeverActive,
    feverStackCount,
    lastFeverResultCount,
    lastFeverResultCycle,
    feverResultSeq,
    startGame: startLocalGame,
    forceGameOver,
    wrongFlashCount,
  } = useGameStore();

  const attackReceivedFlashCount = useGameStore(
    (s) => s.attackReceivedFlashCount,
  );

  const [opponent, setOpponent] = useState<OpponentState>({
    hp: 80,
    queueCount: 3,
    score: 0,
    combo: 0,
    clearedCount: 0,
    targetIngredients: [],
    isFeverActive: false,
    feverStackCount: 0,
    status: "playing",
  });
  const [joined, setJoined] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countingDown, setCountingDown] = useState(false);
  const [versusResult, setVersusResult] = useState<"win" | "loss" | null>(null);
  const versusResultRef = useRef<"win" | "loss" | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [attackSent, setAttackSent] = useState<{
    id: number;
    count: number;
    type: "combo" | "fever_delta";
  } | null>(null);
  const [attackShaking, setAttackShaking] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [opponentFeverResultTick, setOpponentFeverResultTick] = useState(0);

  const attackSentIdRef = useRef(0);
  const attackSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackShakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevComboRef = useRef(0);
  const lastSendRef = useRef(0);
  const finishedRef = useRef(false);
  const gameStatusRef = useRef(gameStatus);
  const myFeverResultsRef = useRef<Record<number, number>>({});
  const opponentFeverResultsRef = useRef<Record<number, number>>({});
  const resolvedFeverCycleRef = useRef<Set<number>>(new Set());
  const feverAttackCooldownUntilRef = useRef(0);
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);

  const showAttackBanner = useCallback((count: number, type: "combo" | "fever_delta") => {
    if (attackSentTimer.current) clearTimeout(attackSentTimer.current);
    attackSentIdRef.current += 1;
    setAttackSent({
      id: attackSentIdRef.current,
      count,
      type,
    });
    attackSentTimer.current = setTimeout(() => setAttackSent(null), 1300);
  }, []);

  const tryResolveFeverDelta = useCallback((cycle: number, sendAttackFn: (count: number, type?: "combo" | "fever_delta") => void) => {
    if (resolvedFeverCycleRef.current.has(cycle)) return;
    const myCount = myFeverResultsRef.current[cycle];
    const opponentCount = opponentFeverResultsRef.current[cycle];
    if (myCount === undefined || opponentCount === undefined) return;

    resolvedFeverCycleRef.current.add(cycle);
    delete myFeverResultsRef.current[cycle];
    delete opponentFeverResultsRef.current[cycle];

    const attackCount = mapFeverDiffToAttack(myCount - opponentCount);
    if (attackCount <= 0) return;

    const now = Date.now();
    if (now < feverAttackCooldownUntilRef.current) return;
    feverAttackCooldownUntilRef.current = now + 2000;

    sendAttackFn(attackCount, "fever_delta");
    showAttackBanner(attackCount, "fever_delta");
  }, [showAttackBanner]);

  useEffect(() => {
    return () => {
      if (attackSentTimer.current) clearTimeout(attackSentTimer.current);
      if (attackShakeTimer.current) clearTimeout(attackShakeTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (!isInitialized) return;
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    setNicknameInput(saved ?? nickname);
  }, [isInitialized, nickname]);

  useEffect(() => {
    if (!isInitialized || !playerId || joined) return;
    setJoined(true);
    const join = async () => {
      const room = await getRoomInfo(roomId);
      if (!room || room.status === "finished") {
        setExpired(true);
        return;
      }

      const { data: myRow } = await supabase
        .from("room_players")
        .select("player_id")
        .eq("room_id", roomId)
        .eq("player_id", playerId)
        .maybeSingle();

      if (myRow) {
        if (room.status === "playing" && roomStatus !== "playing") setExpired(true);
        return;
      }

      if (room.status === "playing") {
        setExpired(true);
        return;
      }

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
  }, [isInitialized, playerId, joined, roomId, nickname, joinExisting, roomStatus]);

  const handleOpponentUpdate = useCallback((state: OpponentState) => {
    setOpponent(state);
  }, []);

  const handleOpponentFeverResult = useCallback(
    (result: { cycle: number; count: number }) => {
      opponentFeverResultsRef.current[result.cycle] = result.count;
      setOpponentFeverResultTick((n) => n + 1);
    },
    [],
  );

  const { sendStateUpdate, sendAttack, sendFeverResult, isConnected } = useVersusRoom(
    roomId,
    playerId ?? "",
    handleOpponentUpdate,
    handleOpponentFeverResult,
  );
  useLobbyRoom(roomId);
  useGameLoop();
  useKeyboard({ enabled: gameStatus === "playing" });

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startLocalGame("versus");
  }, [startLocalGame]);

  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      setCountingDown(true);
    }
  }, [roomStatus, gameStatus]);

  useEffect(() => {
    if (isConnected) {
      lastSendRef.current = 0;
    }
  }, [isConnected]);

  useEffect(() => {
    if (gameStatus !== "playing") return;

    const now = Date.now();
    if (now - lastSendRef.current >= 100) {
      lastSendRef.current = now;
      sendStateUpdate({
        hp,
        queueCount: orders.length,
        score,
        combo,
        clearedCount,
        targetIngredients: orders[0]?.ingredients ?? [],
        isFeverActive,
        feverStackCount,
        status: "playing",
      });
    }

    const comboAttackBlocked = isFeverActive || opponent.isFeverActive;
    if (!comboAttackBlocked && combo === 0 && prevComboRef.current > 0) {
      sendAttack(prevComboRef.current, "combo");
      showAttackBanner(prevComboRef.current, "combo");
    }
    prevComboRef.current = combo;
  }, [
    hp,
    orders,
    combo,
    clearedCount,
    gameStatus,
    score,
    isFeverActive,
    feverStackCount,
    opponent.isFeverActive,
    sendStateUpdate,
    sendAttack,
    showAttackBanner,
  ]);

  useEffect(() => {
    if (feverResultSeq === 0 || lastFeverResultCycle <= 0) return;
    myFeverResultsRef.current[lastFeverResultCycle] = lastFeverResultCount;
    sendFeverResult(lastFeverResultCycle, lastFeverResultCount);
    tryResolveFeverDelta(lastFeverResultCycle, sendAttack);
  }, [
    feverResultSeq,
    lastFeverResultCycle,
    lastFeverResultCount,
    sendFeverResult,
    sendAttack,
    tryResolveFeverDelta,
  ]);

  useEffect(() => {
    for (const key of Object.keys(opponentFeverResultsRef.current)) {
      tryResolveFeverDelta(Number(key), sendAttack);
    }
  }, [opponentFeverResultTick, sendAttack, tryResolveFeverDelta]);

  useEffect(() => {
    if (gameStatus === "gameover") {
      sendStateUpdate({
        hp: 0,
        queueCount: 0,
        score,
        combo,
        clearedCount,
        targetIngredients: [],
        isFeverActive: false,
        feverStackCount: 0,
        status: "gameover",
      });
      if (!finishedRef.current) {
        finishedRef.current = true;
        updateRoomStatus(roomId, "finished").catch(() => {});
      }
    }
  }, [gameStatus, sendStateUpdate, score, combo, clearedCount, roomId]);

  useEffect(() => {
    if (attackReceivedFlashCount === 0) return;
    if (attackShakeTimer.current) clearTimeout(attackShakeTimer.current);
    setAttackShaking(true);
    attackShakeTimer.current = setTimeout(() => setAttackShaking(false), 620);
  }, [attackReceivedFlashCount]);

  useEffect(() => {
    if (wrongFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 420);
  }, [wrongFlashCount]);

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
      markFinished();
    };
  }, [roomId]);

  useEffect(() => {
    if (roomStatus !== "waiting") return;
    const timer = setTimeout(
      async () => {
        await updateRoomStatus(roomId, "finished").catch(() => {});
        setExpired(true);
      },
      10 * 60 * 1000,
    );
    return () => clearTimeout(timer);
  }, [roomId, roomStatus]);

  useEffect(() => {
    if (roomStatus === "finished" && gameStatus === "idle" && !countingDown) {
      setExpired(true);
    }
  }, [roomStatus, gameStatus, countingDown]);

  useEffect(() => {
    if (gameStatus === "gameover" && versusResultRef.current === null) {
      versusResultRef.current = "loss";
      setVersusResult("loss");
    }
  }, [gameStatus]);

  useEffect(() => {
    if (
      opponent.status === "gameover" &&
      gameStatus === "playing" &&
      versusResultRef.current === null
    ) {
      versusResultRef.current = "win";
      setVersusResult("win");
      forceGameOver();
    }
  }, [opponent.status, gameStatus, forceGameOver]);

  useEffect(() => {
    if (
      roomStatus === "finished" &&
      gameStatus === "playing" &&
      versusResultRef.current === null
    ) {
      versusResultRef.current = "win";
      setVersusResult("win");
      forceGameOver();
    }
  }, [roomStatus, gameStatus, forceGameOver]);

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

  if (expired) {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">링크 만료</p>
          <p
            style={{
              fontFamily: "Mulmaru",
              fontSize: "0.85em",
              color: "#9B7060",
              textAlign: "center",
            }}
          >
            이 게임 링크는 이미 사용되었거나 만료되었습니다.
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          메인으로
        </button>
      </div>
    );
  }

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
                <label className="main-nickname__label" htmlFor="vs-nickname">
                  닉네임
                </label>
                <input
                  id="vs-nickname"
                  className="input"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && nicknameInput.trim() && handleReady()
                  }
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
      className={`ingame${attackShaking ? " ingame--attack-shake" : ""}${shaking ? " ingame--shake" : ""}`}
      style={{ display: "flex", flexDirection: "column" }}
    >
      {countingDown && <CountdownScreen onComplete={handleCountdownComplete} />}
      <JudgementPopup />
      <ComboPopup />
      <FeverResultPopup />
      <AttackSentBanner attackInfo={attackSent} />
      <AttackReceivedOverlay />

      <div className="versus-opponent">
        <span className="versus-opponent__name">
          {opponentEntry?.nickname ?? "상대방"}
        </span>
        <span className="versus-opponent__hp">HP {Math.ceil(opponent.hp)}</span>{" "}
        /
        <span className="versus-opponent__cleared">
          ✓ {opponent.clearedCount} clears
        </span>
        <span className="versus-opponent__score">
          {opponent.score.toLocaleString()}
        </span>
        {opponent.status === "gameover" ? (
          <span className="versus-opponent__gameover">GAME OVER</span>
        ) : opponent.isFeverActive ? (
          <span className="versus-opponent__combo">
            FEVER x{opponent.feverStackCount}
          </span>
        ) : opponent.combo >= 2 ? (
          <span className="versus-opponent__combo">
            {opponent.combo}x COMBO
          </span>
        ) : null}
        <MiniBurgerPreview ingredients={opponent.targetIngredients} />
      </div>

      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} />
      </div>
      <InputPanel />
      {gameStatus === "gameover" && <GameOverScreen versusResult={versusResult ?? undefined} />}
    </div>
  );
}
