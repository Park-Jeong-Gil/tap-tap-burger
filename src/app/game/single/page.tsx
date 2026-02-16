"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { useKeyboard } from "@/hooks/useKeyboard";
import { useGameLoop } from "@/hooks/useGameLoop";
import HpBar from "@/components/game/HpBar";
import ScoreBoard from "@/components/game/ScoreBoard";
import InputPanel from "@/components/game/InputPanel";
import GameOverScreen from "@/components/game/GameOverScreen";
import CountdownScreen from "@/components/game/CountdownScreen";
import ComboPopup from "@/components/game/ComboPopup";
import FeverResultPopup from "@/components/game/FeverResultPopup";

export default function SingleGamePage() {
  const status = useGameStore((s) => s.status);
  const hp = useGameStore((s) => s.hp);
  const score = useGameStore((s) => s.score);
  const startGame = useGameStore((s) => s.startGame);
  const wrongFlashCount = useGameStore((s) => s.wrongFlashCount);
  const timeoutFlashCount = useGameStore((s) => s.timeoutFlashCount);

  const [countingDown, setCountingDown] = useState(true);
  const [shaking, setShaking] = useState(false);
  const [timeoutFlashing, setTimeoutFlashing] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startGame("single");
  }, [startGame]);

  // 게임오버 후 resetGame()으로 idle이 되면 카운트다운을 다시 노출한다.
  useEffect(() => {
    if (status === "idle" && !countingDown) {
      setCountingDown(true);
    }
  }, [status, countingDown]);

  // 오답 → 화면 흔들림
  useEffect(() => {
    if (wrongFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 400);
  }, [wrongFlashCount]);

  // 타임아웃 → 붉은 비네트
  useEffect(() => {
    if (timeoutFlashCount === 0) return;
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    setTimeoutFlashing(true);
    timeoutTimer.current = setTimeout(() => setTimeoutFlashing(false), 700);
  }, [timeoutFlashCount]);

  useGameLoop();
  useKeyboard({ enabled: status === "playing" });

  return (
    <div className={`ingame${shaking ? " ingame--shake" : ""}`}>
      {countingDown && (
        <CountdownScreen onComplete={handleCountdownComplete} />
      )}
      {!countingDown && timeoutFlashing && <div className="timeout-vignette" />}
      <ComboPopup />
      <FeverResultPopup />
      <div className="top-display">
        <HpBar hp={hp} />
        <ScoreBoard score={score} />
      </div>
      <InputPanel />
      {status === "gameover" && <GameOverScreen />}
    </div>
  );
}
