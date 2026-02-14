"use client";

import type { Order, Ingredient } from "@/types";

const INGREDIENT_IMAGES: Record<Ingredient, string> = {
  patty: "/ingredient/patty.png",
  cheese: "/ingredient/cheese.png",
  veggie: "/ingredient/vegetable.png",
  sauce: "/ingredient/sauce.png",
  onion: "/ingredient/onion.png",
  tomato: "/ingredient/tomato.png",
};

interface OrderPreviewProps {
  order: Order;
  submittedCount: number;
}

export default function OrderPreview({
  order,
  submittedCount,
}: OrderPreviewProps) {
  const remaining = Math.max(0, order.timeLimit - order.elapsed);
  const timePct = (remaining / order.timeLimit) * 100;
  const isUrgent = timePct < 30;

  return (
    <div className={`order-preview${isUrgent ? " order-preview--urgent" : ""}`}>
      {/* 헤더: 주문 번호 + 남은 시간 */}
      <div className="order-preview__header">
        <span className="order-preview__index">
          주문서 #{order.orderIndex + 1}
        </span>
        <span
          className={`order-preview__time${isUrgent ? " order-preview__time--urgent" : ""}`}
        >
          {Math.ceil(remaining)}s
        </span>
      </div>

      {/* 타이머 바 */}
      <div className="order-preview__timer-wrap">
        <div
          className={`order-preview__timer-bar${isUrgent ? " order-preview__timer-bar--urgent" : ""}`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {/* 목표 버거 비주얼 (column-reverse: bun_bottom → ingredients → bun_top) */}
      <div className="order-preview__food">
        {/* 아래 번 (DOM 첫번째 → 시각적 최하단) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ingredient/bun_bottom.png"
          alt="bun-bottom"
          className="order-preview__bun"
        />

        {/* 재료 레이어 */}
        {order.ingredients.map((ing, i) => {
          const isDone = i < submittedCount;
          const isCurrent = i === submittedCount;
          return (
            <div
              key={i}
              className={[
                "order-preview__layer",
                `order-preview__layer--${ing}`,
                isDone ? "order-preview__layer--done" : "",
                isCurrent ? "order-preview__layer--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={INGREDIENT_IMAGES[ing]} alt={ing} />
              {isDone && <span className="order-preview__check">✓</span>}
            </div>
          );
        })}

        {/* 위 번 (DOM 마지막 → 시각적 최상단) */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/ingredient/bun_top.png"
          alt="bun-top"
          className="order-preview__bun order-preview__bun--top"
        />
      </div>
    </div>
  );
}
