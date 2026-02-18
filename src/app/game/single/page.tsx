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
import JudgementPopup from "@/components/game/JudgementPopup";

export default function SingleGamePage() {
  const status = useGameStore((s) => s.status);
  const hp = useGameStore((s) => s.hp);
  const score = useGameStore((s) => s.score);
  const startGame = useGameStore((s) => s.startGame);
  const resetGame = useGameStore((s) => s.resetGame);
  const wrongFlashCount = useGameStore((s) => s.wrongFlashCount);
  const timeoutFlashCount = useGameStore((s) => s.timeoutFlashCount);

  const [countingDown, setCountingDown] = useState(true);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset previous game state on page entry (handles restart after back navigation)
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  const handleCountdownComplete = useCallback(() => {
    setCountingDown(false);
    startGame("single");
  }, [startGame]);

  // After gameover, resetGame() sets idle — show countdown again.
  useEffect(() => {
    if (status === "idle" && !countingDown) {
      setCountingDown(true);
    }
  }, [status, countingDown]);

  // Wrong answer or timeout → screen shake
  useEffect(() => {
    if (wrongFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 400);
  }, [wrongFlashCount]);

  useEffect(() => {
    if (timeoutFlashCount === 0) return;
    if (shakeTimer.current) clearTimeout(shakeTimer.current);
    setShaking(true);
    shakeTimer.current = setTimeout(() => setShaking(false), 400);
  }, [timeoutFlashCount]);

  useGameLoop();
  useKeyboard({ enabled: status === "playing" });

  return (
    <div className={`ingame${shaking ? " ingame--shake" : ""}`}>
      {countingDown && (
        <CountdownScreen onComplete={handleCountdownComplete} />
      )}
      <JudgementPopup />
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
