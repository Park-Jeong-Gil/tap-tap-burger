"use client";

import { useEffect } from "react";
import { KEY_MAP } from "@/lib/constants";
import { useGameStore } from "@/stores/gameStore";
import type { Ingredient } from "@/types";

interface UseKeyboardOptions {
  allowedActions?: string[]; // coop: 배정된 액션만 허용
  enabled?: boolean;
}

export function useKeyboard({
  allowedActions,
  enabled = true,
}: UseKeyboardOptions = {}) {
  const addIngredient = useGameStore((s) => s.addIngredient);
  const clearBurger = useGameStore((s) => s.clearBurger);
  const submitBurger = useGameStore((s) => s.submitBurger);
  const status = useGameStore((s) => s.status);

  useEffect(() => {
    if (!enabled || status !== "playing") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      // 인풋 포커스 중에는 무시
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const action = KEY_MAP[e.key];
      if (!action) return;

      // allowedActions 필터 (coop 모드)
      if (allowedActions && !allowedActions.includes(action)) return;

      e.preventDefault();

      if (action === "cancel") {
        // clearBurger();
      } else if (action === "submit") {
        submitBurger();
      } else {
        addIngredient(action as Ingredient);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    enabled,
    status,
    allowedActions,
    addIngredient,
    clearBurger,
    submitBurger,
  ]);
}
