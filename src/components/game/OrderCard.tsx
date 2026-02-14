"use client";

import { useEffect, useRef } from "react";
import type { Order, Ingredient } from "@/types";

const INGREDIENT_LABELS: Record<Ingredient, string> = {
  patty: "🟫 패티",
  cheese: "🟨 치즈",
  veggie: "🟩 야채",
  sauce: "🟥 소스",
  onion: "🟣 양파",
  tomato: "🍅 토마토",
};

interface OrderCardProps {
  order: Order;
  submittedCount: number; // 현재까지 올바르게 입력된 재료 수
  isFirst: boolean; // 첫 번째 주문서 (현재 타겟)
  isNew?: boolean;
}

export default function OrderCard({
  order,
  submittedCount,
  isFirst,
  isNew,
}: OrderCardProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const remaining = Math.max(0, order.timeLimit - order.elapsed);
  const timePct = (remaining / order.timeLimit) * 100;
  const isUrgent = timePct < 30;

  // 입력된 재료에 맞춰 자동 스크롤
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
      {/* 타임 바 */}
      {/* <div
        className={`order-card__timer${isUrgent ? ' order-card__timer--urgent' : ''}`}
        style={{ width: `${timePct}%` }}
      /> */}

      <div className="order-card__header">
        <p className="order-card__index">#{order.orderIndex + 1}</p>
        <p
          className={`order-card__time${isUrgent ? " order-card__time--urgent" : ""}`}
        >
          {Math.ceil(remaining)}s
        </p>
      </div>

      <div className="order-card__ingredients" ref={listRef}>
        {order.ingredients.map((ing, i) => {
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
