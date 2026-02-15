"use client";

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Ingredient } from "@/types";
import { useGameStore } from "@/stores/gameStore";
import BurgerStack from "./BurgerStack";
import OrderPreview from "./OrderPreview";

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
  const orders = useGameStore((s) => s.orders);
  const inputLockedAt = useGameStore((s) => s.inputLockedAt);

  const firstOrder = orders[0] ?? null;
  const isPlaying = status === "playing";

  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const [inputBlocked, setInputBlocked] = useState(false);
  useEffect(() => {
    if (inputLockedAt === 0) return;
    setInputBlocked(true);
    const t = setTimeout(() => setInputBlocked(false), 200);
    return () => clearTimeout(t);
  }, [inputLockedAt]);

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
      {/* 플레이 영역: 목표 주문서(좌) | 현재 버거 스택(우) */}
      <div className="ingame__play-area">
        <div
          className={`ingame__order-col${!isPlaying ? " ingame__order-col--hidden" : ""}`}
        >
          <AnimatePresence mode="wait">
            {isPlaying && firstOrder && (
              <motion.div
                key={firstOrder.orderIndex}
                style={{ width: "100%", height: "100%", position: "relative", zIndex: 3 }}
                initial={{ scale: 0.84, opacity: 0, y: 8 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                exit={{
                  x: -80,
                  scale: 0.88,
                  opacity: 0,
                  transition: { duration: 0.19, ease: "easeIn" },
                }}
              >
                <OrderPreview
                  order={firstOrder}
                  submittedCount={currentBurger.length}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="ingame__burger-area">
          <BurgerStack ingredients={currentBurger} />
        </div>
      </div>

      {/* 컨트롤: [재료 2×3] [완성] */}
      <div className="ingame__controls">
        <div className="ingame__grid">
          <InputBtn
            action="veggie"
            label="야채"
            className="input-btn--veggie"
            disabled={!isAllowed("veggie") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("veggie")}
          />
          <InputBtn
            action="sauce"
            label="소스"
            className="input-btn--sauce"
            disabled={!isAllowed("sauce") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("sauce")}
          />
          <InputBtn
            action="cheese"
            label="치즈"
            className="input-btn--cheese"
            disabled={!isAllowed("cheese") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("cheese")}
          />
          <InputBtn
            action="patty"
            label="패티"
            className="input-btn--patty"
            disabled={!isAllowed("patty") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("patty")}
          />
          <InputBtn
            action="onion"
            label="양파"
            className="input-btn--onion"
            disabled={!isAllowed("onion") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("onion")}
          />
          <InputBtn
            action="tomato"
            label="토마토"
            className="input-btn--tomato"
            disabled={!isAllowed("tomato") || inputBlocked}
            showKey={isDesktop}
            onClick={() => handleAction("tomato")}
          />
        </div>

        <InputBtn
          action="submit"
          label="완성"
          className="input-btn--submit"
          disabled={!isAllowed("submit") || inputBlocked}
          showKey={isDesktop}
          onClick={() => handleAction("submit")}
        />
      </div>
    </div>
  );
}
