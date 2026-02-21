"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useRoomStore } from "@/stores/roomStore";
import { useGameStore } from "@/stores/gameStore";
import { useGameLoop } from "@/hooks/useGameLoop";
import { useCoopRoom, useLobbyRoom } from "@/hooks/useRoom";
import {
  supabase,
  getRoomInfo,
  updateRoomStatus,
  markRoomFinishedBeacon,
  leaveRoom,
  leaveRoomBeacon,
  upsertCoopTeamScore,
} from "@/lib/supabase";
import { assignCoopKeys } from "@/lib/gameLogic";
import { KEY_MAP, NICKNAME_STORAGE_KEY } from "@/lib/constants";
import HpBar from "@/components/game/HpBar";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import CountdownScreen from "@/components/game/CountdownScreen";
import ComboPopup from "@/components/game/ComboPopup";
import FeverResultPopup from "@/components/game/FeverResultPopup";
import JudgementPopup from "@/components/game/JudgementPopup";
import type { Ingredient } from "@/types";
import { useLocale } from "@/providers/LocaleProvider";

export default function CoopGamePage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const router = useRouter();

  const { playerId, nickname, setNickname, saveNickname, initSession, isInitialized } = usePlayerStore();
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
    maxCombo,
    isFeverActive,
    feverIngredient,
    startGame: startLocalGame,
    addIngredient,
    removeLastIngredient,
    submitBurger,
    passOrder,
    forceGameOver,
    wrongFlashCount,
    resetGame,
  } = useGameStore();

  const { t } = useLocale();
  const [assignedKeys, setAssignedKeys] = useState<string[]>([]);
  const [joined, setJoined] = useState(false);
  const [expired, setExpired] = useState(false);
  const [countingDown, setCountingDown] = useState(false);
  const [shaking, setShaking] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const finishedRef = useRef(false);
  const teamScoreSavedRef = useRef(false);
  const teamScoreSavingRef = useRef(false);
  const gameStatusRef = useRef(gameStatus);
  const roomStatusRef = useRef(roomStatus);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    gameStatusRef.current = gameStatus;
  }, [gameStatus]);
  useEffect(() => {
    roomStatusRef.current = roomStatus;
  }, [roomStatus]);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  // 뒤로가기 등으로 페이지를 벗어날 때 게임/룸 상태 초기화
  // 미처리 시 다음 게임이 이전 게임의 상태(HP, 주문 등)로 시작되는 버그 방지
  useEffect(() => {
    return () => {
      resetGame();
      resetRoom();
    };
  }, [resetGame, resetRoom]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Initialize nickname input (saved value or current nickname)
  useEffect(() => {
    if (!isInitialized) return;
    const saved = localStorage.getItem(NICKNAME_STORAGE_KEY);
    setNicknameInput(saved ?? nickname);
  }, [isInitialized, nickname]);

  // Join room
  useEffect(() => {
    if (!isInitialized || !playerId || joined) return;
    setJoined(true);

    const join = async () => {
      try {
        // Check room status
        const room = await getRoomInfo(roomId);
        if (!room || room.status === "finished") {
          setExpired(true);
          return;
        }

        // Check if already in the room
        const { data } = await supabase
          .from("room_players")
          .select("player_id, ready, assigned_keys")
          .eq("room_id", roomId)
          .eq("player_id", playerId)
          .maybeSingle();

        if (!data) {
          // New player: if game is in progress, mark as expired
          if (room.status === "playing") {
            setExpired(true);
            return;
          }
          await joinExisting(roomId, playerId, nickname);
        } else if (room.status === "playing" && roomStatus !== "playing") {
          // Existing participant reconnecting mid-game (refresh, etc.) → mark as expired
          // Exception: if roomStatus is already 'playing', host entered normally after starting from multi page
          setExpired(true);
          return;
        }

        // Key assignment: based on deterministic player_id order
        const { data: rp } = await supabase
          .from("room_players")
          .select("assigned_keys")
          .eq("room_id", roomId)
          .eq("player_id", playerId)
          .single();

        if (rp?.assigned_keys && rp.assigned_keys.length > 0) {
          setAssignedKeys(rp.assigned_keys);
        } else {
          const [keys1, keys2] = assignCoopKeys(roomId);
          const { data: members } = await supabase
            .from("room_players")
            .select("player_id")
            .eq("room_id", roomId);
          const orderedIds = Array.from(
            new Set(
              (members ?? [])
                .map((row) => row.player_id as string | null)
                .filter((id): id is string => Boolean(id)),
            ),
          ).sort();
          const myIndex = orderedIds.findIndex((id) => id === playerId);
          const myKeys = myIndex > 0 ? keys2 : keys1;
          setAssignedKeys(myKeys);
          await supabase
            .from("room_players")
            .update({ assigned_keys: myKeys })
            .eq("room_id", roomId)
            .eq("player_id", playerId);
        }
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

  const { sendInput } = useCoopRoom(roomId, playerId ?? "");
  useLobbyRoom(roomId);
  useGameLoop();

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startLocalGame("coop");
  }, [startLocalGame]);

  // Game start → countdown → start local game
  useEffect(() => {
    if (roomStatus === "playing" && gameStatus === "idle") {
      setCountingDown(true);
    }
  }, [roomStatus, gameStatus]);

  // On game over, mark room as finished (prevent link reuse)
  useEffect(() => {
    if (gameStatus === "gameover" && !finishedRef.current) {
      finishedRef.current = true;
      updateRoomStatus(roomId, "finished").catch(() => {});
    }
  }, [gameStatus, roomId]);

  // Co-op leaderboard: persist one team entry (nickname1 | nickname2) per pair.
  useEffect(() => {
    if (gameStatus !== "gameover" || teamScoreSavedRef.current || teamScoreSavingRef.current) return;

    teamScoreSavingRef.current = true;

    const sleep = (ms: number) => new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });

    const getTeamPlayerIds = async (): Promise<string[]> => {
      const fromStore = Array.from(
        new Set(
          players
            .map((p) => p.playerId)
            .filter((id): id is string => Boolean(id)),
        ),
      );
      if (fromStore.length >= 2) return fromStore.sort();

      const { data, error } = await supabase
        .from("room_players")
        .select("player_id")
        .eq("room_id", roomId);
      if (error) throw error;

      return Array.from(
        new Set(
          (data ?? [])
            .map((row) => row.player_id as string | null)
            .filter((id): id is string => Boolean(id)),
        ),
      ).sort();
    };

    const persistTeamScore = async () => {
      try {
        for (let attempt = 1; attempt <= 5; attempt++) {
          try {
            const playerIds = await getTeamPlayerIds();
            if (playerIds.length < 2) {
              throw new Error("not enough players to persist coop team score");
            }

            const [idA, idB] = playerIds;
            await upsertCoopTeamScore(roomId, idA, idB, score, maxCombo);
            teamScoreSavedRef.current = true;
            console.info("[coop] team score persisted", {
              roomId,
              score,
              maxCombo,
              playerIds,
            });
            return;
          } catch (error) {
            if (attempt === 5) throw error;
            await sleep(300 * attempt);
          }
        }
      } catch (error) {
        console.error("[coop] failed to persist team score after retries", {
          roomId,
          score,
          maxCombo,
          playersFromStore: players.map((p) => p.playerId),
          error,
        });
      } finally {
        teamScoreSavingRef.current = false;
      }
    };

    persistTeamScore();
  }, [gameStatus, maxCombo, players, roomId, score]);

  // Leaving mid-game (tab close / unmount) → mark room as finished
  useEffect(() => {
    const markFinished = () => {
      if (gameStatusRef.current === "playing" && !finishedRef.current) {
        finishedRef.current = true;
        // Update local state first so expired screen shows immediately on back navigation
        setRoomStatus("finished");
        updateRoomStatus(roomId, "finished").catch(() => {});
        markRoomFinishedBeacon(roomId);
      }
    };
    window.addEventListener("beforeunload", markFinished);
    window.addEventListener("pagehide", markFinished);
    return () => {
      window.removeEventListener("beforeunload", markFinished);
      window.removeEventListener("pagehide", markFinished);
      markFinished(); // Also run on component unmount (SPA navigation)
    };
  }, [roomId, setRoomStatus]);

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

  // 10-minute lobby timeout → auto-expire
  useEffect(() => {
    if (roomStatus !== "waiting") return;
    const timer = setTimeout(async () => {
      await updateRoomStatus(roomId, "finished").catch(() => {});
      setExpired(true);
    }, 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [roomId, roomStatus]);

  // Opponent marked room as expired (before game starts) → show expired screen
  useEffect(() => {
    if (roomStatus === "finished" && gameStatus === "idle" && !countingDown) {
      setExpired(true);
    }
  }, [roomStatus, gameStatus, countingDown]);

  // If opponent leaves mid-game and room expires, force game over immediately
  useEffect(() => {
    if (roomStatus === "finished" && gameStatus === "playing") {
      forceGameOver();
    }
  }, [roomStatus, gameStatus, forceGameOver]);

  // Wrong submission → screen shake
  useEffect(() => {
    if (wrongFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 420);
  }, [wrongFlashCount]);

  // Keyboard input → co-op broadcast
  useEffect(() => {
    if (gameStatus !== "playing" || assignedKeys.length === 0) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const action = KEY_MAP[e.key];
      if (!action) return;

      const allowedDuringFever =
        isFeverActive && (action === "submit" || action === feverIngredient);
      if (!allowedDuringFever && action !== "pass" && !assignedKeys.includes(action)) return;

      e.preventDefault();
      if (action === "cancel") removeLastIngredient();
      else if (action === "submit") submitBurger();
      else if (action === "pass") { passOrder(); sendInput("pass"); return; }
      else addIngredient(action as Ingredient);

      // Broadcast to opponent
      sendInput(action);
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    gameStatus,
    assignedKeys,
    isFeverActive,
    feverIngredient,
    addIngredient,
    removeLastIngredient,
    submitBurger,
    passOrder,
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

  // Expired link screen
  if (expired) {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{t.linkExpired}</p>
          <p style={{ fontFamily: "Mulmaru", fontSize: "0.85em", color: "#9B7060", textAlign: "center" }}>
            {t.linkExpiredDesc}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => router.push("/")}>
          {t.backToMain}
        </button>
      </div>
    );
  }

  // Lobby screen
  if (roomStatus === "waiting") {
    return (
      <div className="multi-hub">
        <div className="room-lobby">
          <p className="room-lobby__title">{t.coopLobby}</p>
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
                <label className="main-nickname__label" htmlFor="coop-nickname">{t.nickname}</label>
                <input
                  id="coop-nickname"
                  className="input"
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && nicknameInput.trim() && handleReady()}
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
    <div className={`ingame${shaking ? " ingame--shake" : ""}`}>
      {countingDown && <CountdownScreen onComplete={handleCountdownComplete} />}
      <JudgementPopup />
      <ComboPopup />
      <FeverResultPopup />
      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} />
      </div>
      <InputPanel allowedActions={assignedKeys} onAction={sendInput} />
      {gameStatus === "gameover" && <GameOverScreen />}
    </div>
  );
}
