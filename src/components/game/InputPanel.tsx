"use client";

import React, { useEffect, useState } from "react";
import { GrPowerCycle } from "@react-icons/all-files/gr/GrPowerCycle";
import type { Ingredient } from "@/types";
import { useGameStore } from "@/stores/gameStore";
import BurgerStack from "./BurgerStack";

interface InputPanelProps {
  allowedActions?: string[];
}

const KEY_HINTS: Record<string, string> = {
  patty: "W",
  cheese: "S",
  veggie: "A",
  sauce: "D",
  onion: "Q",
  tomato: "E",
  cancel: "ESC",
  submit: "SPACE",
};

const INGREDIENT_IMAGES: Record<string, string> = {
  patty: "/ingredient/patty.png",
  cheese: "/ingredient/cheese.png",
  veggie: "/ingredient/vegetable.png",
  sauce: "/ingredient/sauce.png",
  onion: "/ingredient/onion.png",
  tomato: "/ingredient/tomato.png",
  submit: "/ingredient/bun_top.png",
};

function InputBtn({
  action,
  label,
  className,
  disabled,
  showKey,
  icon,
  onClick,
}: {
  action: string;
  label: string;
  className: string;
  disabled: boolean;
  showKey: boolean;
  icon?: React.ReactNode;
  onClick: () => void;
}) {
  const hasImage = action in INGREDIENT_IMAGES;
  return (
    <button
      className={`input-btn ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="input-btn__img">{icon}</span>}
      {!icon && hasImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={INGREDIENT_IMAGES[action]}
          alt={label}
          className="input-btn__img"
        />
      )}
      <span className="input-btn__label">{label}</span>
      {showKey && <kbd className="input-btn__key">{KEY_HINTS[action]}</kbd>}
    </button>
  );
}

export default function InputPanel({ allowedActions }: InputPanelProps) {
  const addIngredient = useGameStore((s) => s.addIngredient);
  const clearBurger = useGameStore((s) => s.clearBurger);
  const submitBurger = useGameStore((s) => s.submitBurger);
  const currentBurger = useGameStore((s) => s.currentBurger);
  const status = useGameStore((s) => s.status);

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isAllowed = (action: string) =>
    !allowedActions || allowedActions.includes(action);

  const handleAction = (action: string | Ingredient) => {
    if (status !== "playing") return;
    if (action === "cancel") clearBurger();
    else if (action === "submit") submitBurger();
    else addIngredient(action as Ingredient);
  };

  return (
    <div className="ingame__bottom">
      {/* 버거 표시 영역 (전체 너비, 남은 공간 차지) */}
      <div className="ingame__burger-area">
        <BurgerStack ingredients={currentBurger} />
      </div>

      {/* 컨트롤: [리셋] [재료 2×2] [완성] */}
      <div className="ingame__controls">
        {/* <InputBtn
          action="cancel"
          label="리셋"
          className="input-btn--cancel"
          disabled={!isAllowed("cancel")}
          showKey={isDesktop}
          icon={<GrPowerCycle />}
          onClick={() => handleAction("cancel")}
        /> */}

        <div className="ingame__grid">
          <InputBtn
            action="veggie"
            label="야채"
            className="input-btn--veggie"
            disabled={!isAllowed("veggie")}
            showKey={isDesktop}
            onClick={() => handleAction("veggie")}
          />
          <InputBtn
            action="sauce"
            label="소스"
            className="input-btn--sauce"
            disabled={!isAllowed("sauce")}
            showKey={isDesktop}
            onClick={() => handleAction("sauce")}
          />
          <InputBtn
            action="cheese"
            label="치즈"
            className="input-btn--cheese"
            disabled={!isAllowed("cheese")}
            showKey={isDesktop}
            onClick={() => handleAction("cheese")}
          />
          <InputBtn
            action="patty"
            label="패티"
            className="input-btn--patty"
            disabled={!isAllowed("patty")}
            showKey={isDesktop}
            onClick={() => handleAction("patty")}
          />
          <InputBtn
            action="onion"
            label="양파"
            className="input-btn--onion"
            disabled={!isAllowed("onion")}
            showKey={isDesktop}
            onClick={() => handleAction("onion")}
          />
          <InputBtn
            action="tomato"
            label="토마토"
            className="input-btn--tomato"
            disabled={!isAllowed("tomato")}
            showKey={isDesktop}
            onClick={() => handleAction("tomato")}
          />
        </div>

        <InputBtn
          action="submit"
          label="완성"
          className="input-btn--submit"
          disabled={!isAllowed("submit")}
          showKey={isDesktop}
          onClick={() => handleAction("submit")}
        />
      </div>
    </div>
  );
}
