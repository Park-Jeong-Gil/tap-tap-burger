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
  leaveRoom,
  leaveRoomBeacon,
} from "@/lib/supabase";
import { NICKNAME_STORAGE_KEY, HP_INIT } from "@/lib/constants";
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
import AttackProjectileLayer, {
  type AttackProjectilePulse,
} from "@/components/game/AttackProjectileLayer";
import MiniBurgerPreview from "@/components/game/MiniBurgerPreview";
import type { Ingredient } from "@/types";
import { useLocale } from "@/providers/LocaleProvider";

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
    players,
    roomStatus,
    joinExisting,
    setReady,
    startGame,
    setRoomStatus,
    reset: resetRoom,
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
    resetGame,
  } = useGameStore();

  const attackReceivedFlashCount = useGameStore(
    (s) => s.attackReceivedFlashCount,
  );
  const attackReceivedCount = useGameStore((s) => s.attackReceivedCount);
  const attackReceivedType = useGameStore((s) => s.attackReceivedType);

  const { t } = useLocale();
  const [opponent, setOpponent] = useState<OpponentState>({
    hp: HP_INIT,
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
  const [projectiles, setProjectiles] = useState<AttackProjectilePulse[]>([]);
  const [forcedTerminationWin, setForcedTerminationWin] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const attackSentIdRef = useRef(0);
  const projectileIdRef = useRef(0);
  const attackSentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackShakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const opponentPanelRef = useRef<HTMLDivElement | null>(null);
  const myHudRef = useRef<HTMLDivElement | null>(null);
  const prevComboRef = useRef(0);
  const lastSendRef = useRef(0);
  const finishedRef = useRef(false);
  const gameStatusRef = useRef(gameStatus);
  const myFeverResultsRef = useRef<Record<number, number>>({});
  const opponentFeverResultsRef = useRef<Record<number, number>>({});
  const resolvedFeverCycleRef = useRef<Set<number>>(new Set());
  const feverAttackCooldownUntilRef = useRef(0);
  const roomStatusRef = useRef(roomStatus);
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);
  useEffect(() => {
    roomStatusRef.current = roomStatus;
  }, [roomStatus]);

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

  const emitProjectile = useCallback((
    direction: "outgoing" | "incoming",
    type: "combo" | "fever_delta",
    count: number,
  ) => {
    if (count <= 0 || typeof window === "undefined") return;

    const getCenter = (
      el: HTMLElement | null,
      fallback: { x: number; y: number },
    ) => {
      if (!el) return fallback;
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };

    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const myCenter = getCenter(myHudRef.current, {
      x: viewportW * 0.5,
      y: viewportH * 0.78,
    });
    const opponentCenter = getCenter(opponentPanelRef.current, {
      x: viewportW * 0.5,
      y: viewportH * 0.18,
    });

    projectileIdRef.current += 1;
    setProjectiles((prev) => [
      ...prev,
      {
        id: projectileIdRef.current,
        count,
        type,
        direction,
        from: direction === "outgoing" ? myCenter : opponentCenter,
        to: direction === "outgoing" ? opponentCenter : myCenter,
      },
    ]);
  }, []);

  const handleProjectileDone = useCallback((id: number) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== id));
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
    emitProjectile("outgoing", "fever_delta", attackCount);
  }, [showAttackBanner, emitProjectile]);

  useEffect(() => {
    return () => {
      if (attackSentTimer.current) clearTimeout(attackSentTimer.current);
      if (attackShakeTimer.current) clearTimeout(attackShakeTimer.current);
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  // 뒤로가기 등으로 페이지를 벗어날 때 게임/룸 상태 초기화
  // 미처리 시 다음 게임이 이전 게임의 상태(HP, 주문 등)로 시작되는 버그 방지
  useEffect(() => {
    return () => {
      // resetRoom()이 roomStatus를 'waiting'으로 초기화하면 useLobbyRoom이 재실행되며
      // 대기실 화면이 2~3초 렌더되는 플래시 발생 → leaving state로 렌더를 차단
      setIsLeaving(true);
      resetGame();
      resetRoom();
    };
  }, [resetGame, resetRoom]);

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
      try {
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
      } catch (error) {
        const code = (error as Error & { code?: string }).code ?? (error as Error).message;
        if (
          code === "expired" ||
          code === "room_full" ||
          code === "not_waiting" ||
          code === "not_found"
        ) {
          setExpired(true);
        }
      }
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
    if (!comboAttackBlocked) {
      if (combo === 0 && prevComboRef.current > 0) {
        const remaining = prevComboRef.current % 6;
        if (remaining > 0) {
          sendAttack(remaining, "combo");
          showAttackBanner(remaining, "combo");
          emitProjectile("outgoing", "combo", remaining);
        }
      } else if (combo > 0) {
        const prevChunks = Math.floor(prevComboRef.current / 6);
        const curChunks = Math.floor(combo / 6);
        if (curChunks > prevChunks) {
          sendAttack(6, "combo");
          showAttackBanner(6, "combo");
          emitProjectile("outgoing", "combo", 6);
        }
      }
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
    emitProjectile,
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
    emitProjectile("incoming", attackReceivedType, attackReceivedCount);
  }, [
    attackReceivedFlashCount,
    attackReceivedCount,
    attackReceivedType,
    emitProjectile,
  ]);

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

  // Leaving lobby before game start → remove my seat row
  useEffect(() => {
    if (!playerId) return;
    const leaveWaitingRoom = () => {
      if (roomStatusRef.current === "waiting") {
        leaveRoomBeacon(roomId, playerId);
      }
    };
    window.addEventListener("beforeunload", leaveWaitingRoom);
    window.addEventListener("pagehide", leaveWaitingRoom);
    return () => {
      window.removeEventListener("beforeunload", leaveWaitingRoom);
      window.removeEventListener("pagehide", leaveWaitingRoom);
      if (roomStatusRef.current === "waiting") {
        leaveRoom(roomId, playerId).catch(() => {});
        leaveRoomBeacon(roomId, playerId);
      }
    };
  }, [roomId, playerId]);

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
      // HP 기준: 상대방이 먼저 gameover됐으면(=내 forceGameOver 유발) 승리,
      // 내 HP가 먼저 0이 됐으면 패배
      const result = opponent.status === "gameover" ? "win" : "loss";
      versusResultRef.current = result;
      setVersusResult(result);
    }
  }, [gameStatus, opponent.status]);

  useEffect(() => {
    if (
      opponent.status === "gameover" &&
      gameStatus === "playing" &&
      versusResultRef.current === null
    ) {
      forceGameOver();
    }
  }, [opponent.status, gameStatus, forceGameOver]);

  useEffect(() => {
    if (
      roomStatus === "finished" &&
      gameStatus === "playing" &&
      versusResultRef.current === null
    ) {
      setForcedTerminationWin(true);
      versusResultRef.current = "win";
      setVersusResult("win");
      forceGameOver();
    }
  }, [roomStatus, gameStatus, forceGameOver]);

  // 게임 중 상대방이 강제 이탈하면 broadcast가 끊겨 opponent 상태를 받지 못함.
  // DB room status를 3초마다 폴링해 "finished"가 되면 setRoomStatus → 위 effect가 승리 처리.
  useEffect(() => {
    if (gameStatus !== "playing") return;
    const poll = setInterval(async () => {
      if (versusResultRef.current !== null) return;
      const room = await getRoomInfo(roomId);
      if (room?.status === "finished") {
        setRoomStatus("finished");
      }
    }, 3000);
    return () => clearInterval(poll);
  }, [gameStatus, roomId, setRoomStatus]);

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
    if (!playerId) return;
    try {
      await startGame(roomId, playerId);
      setRoomStatus("playing");
    } catch (error) {
      const code = (error as Error & { code?: string }).code ?? (error as Error).message;
      if (code === "expired") {
        setRoomStatus("finished");
        setExpired(true);
      } else if (code === "not_waiting") {
        setRoomStatus("playing");
      }
    }
  };

  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const myEntry = players.find((p) => p.playerId === playerId);
  const myReady = myEntry?.ready ?? false;
  const opponentEntry = players.find((p) => p.playerId !== playerId);

  if (isLeaving) return null;

  if (expired) {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{t.linkExpired}</p>
          <p
            style={{
              fontFamily: "Mulmaru",
              fontSize: "0.85em",
              color: "#9B7060",
              textAlign: "center",
            }}
          >
            {t.linkExpiredDesc}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          {t.backToMain}
        </button>
      </div>
    );
  }

  if (roomStatus === "waiting") {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{t.versusLobby}</p>
          <div className="room-lobby__players">
            {players.map((p) => (
              <div
                key={p.playerId}
                className={`room-lobby__player${p.ready ? " room-lobby__player--ready" : ""}`}
              >
                <span>
                  {p.nickname} {p.playerId === playerId ? t.me : ""}
                </span>
                <span>{p.ready ? t.readyMark : t.waiting}</span>
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
                {t.waitingForOpponent}
              </p>
            )}
          </div>
          {!myReady && (
            <>
              <div className="main-nickname" style={{ width: "100%" }}>
                <label className="main-nickname__label" htmlFor="vs-nickname">
                  {t.nickname}
                </label>
                <input
                  id="vs-nickname"
                  className="input"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && nicknameInput.trim() && handleReady()
                  }
                  placeholder={t.nicknamePlaceholder}
                  maxLength={20}
                  autoFocus
                />
              </div>
              <button
                className="btn btn--primary"
                onClick={handleReady}
                disabled={!nicknameInput.trim()}
              >
                {t.ready}
              </button>
            </>
          )}
          {myReady && (
            <button
              className="btn btn--primary"
              onClick={handleStart}
              disabled={!allReady}
            >
              {allReady
                ? t.startGame
                : players.length < 2
                  ? t.waitingForAllPlayers
                  : t.waitingForOpponentReady}
            </button>
          )}
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          {t.cancel}
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
      <AttackProjectileLayer pulses={projectiles} onDone={handleProjectileDone} />

      <div className="versus-opponent" ref={opponentPanelRef}>
        <span className="versus-opponent__name">
          {opponentEntry?.nickname ?? t.opponent}
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

      <div className="top-display" ref={myHudRef}>
        <HpBar hp={hp} />
        <ScoreBoard score={score} />
      </div>
      <InputPanel />
      {gameStatus === "gameover" && (
        <GameOverScreen
          versusResult={versusResult ?? undefined}
          allowZeroScoreSave={forcedTerminationWin && versusResult === "win"}
        />
      )}
    </div>
  );
}
