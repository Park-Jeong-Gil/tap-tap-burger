"use client";

import { useEffect, useRef } from "react";
import type { Order, Ingredient } from "@/types";
import { useLocale } from "@/providers/LocaleProvider";

interface OrderCardProps {
  order: Order;
  submittedCount: number; // number of correctly submitted ingredients so far
  isFirst: boolean; // first order card (current target)
  isNew?: boolean;
}

export default function OrderCard({
  order,
  submittedCount,
  isFirst,
  isNew,
}: OrderCardProps) {
  const { t } = useLocale();
  const listRef = useRef<HTMLDivElement>(null);
  const remaining = Math.max(0, order.timeLimit - order.elapsed);
  const timePct = (remaining / order.timeLimit) * 100;
  const isUrgent = timePct < 30;
  const isFever = order.type === "fever";
  const feverIngredient = order.feverIngredient ?? order.ingredients[0];

  const INGREDIENT_LABELS: Record<Ingredient, string> = {
    patty: t.pattyLabel,
    cheese: t.cheeseLabel,
    veggie: t.veggieLabel,
    sauce: t.sauceLabel,
    onion: t.onionLabel,
    tomato: t.tomatoLabel,
  };

  // Auto-scroll to match submitted ingredient
  useEffect(() => {
    if (!listRef.current || !isFirst) return;
    const items = listRef.current.querySelectorAll<HTMLElement>(
      ".order-card__ingredient",
    );
    if (items[submittedCount]) {
      items[submittedCount].scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [submittedCount, isFirst]);

  return (
    <div
      className={[
        "order-card",
        isUrgent && isFirst ? "order-card--urgent" : "",
        isNew ? "order-card--enter" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Timer bar */}
      {/* <div
        className={`order-card__timer${isUrgent ? ' order-card__timer--urgent' : ''}`}
        style={{ width: `${timePct}%` }}
      /> */}

      <div className="order-card__header">
        <p className="order-card__index">
          {isFever ? t.feverBadge : `#${order.orderIndex + 1}`}
        </p>
        <p
          className={`order-card__time${isUrgent ? " order-card__time--urgent" : ""}`}
        >
          {Math.ceil(remaining)}s
        </p>
      </div>

      <div className="order-card__ingredients" ref={listRef}>
        {isFever && feverIngredient ? (
          <span className="order-card__ingredient">
            🔥 {INGREDIENT_LABELS[feverIngredient]}
          </span>
        ) : order.ingredients.map((ing, i) => {
          const isDone = isFirst && i < submittedCount;
          const isCurrent = isFirst && i === submittedCount;
          return (
            <span
              key={i}
              className={[
                "order-card__ingredient",
                isDone ? "order-card__ingredient--done" : "",
                isCurrent ? "order-card__ingredient--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {INGREDIENT_LABELS[ing]}
            </span>
          );
        })}
      </div>
    </div>
  );
}
