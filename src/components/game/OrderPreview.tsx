"use client";

import { useRef, useEffect } from "react";
import type { Order, Ingredient } from "@/types";
import { FEVER_SCORE_PER_STACK } from "@/lib/constants";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const foodRef = useRef<HTMLDivElement>(null);

  const remaining = Math.max(0, order.timeLimit - order.elapsed);
  const timePct = (remaining / order.timeLimit) * 100;
  const isUrgent = timePct < 30;
  const isFever = order.type === "fever";
  const feverIngredient = order.feverIngredient ?? order.ingredients[0];
  const remainingText =
    isFever && remaining < 1
      ? `${remaining.toFixed(1)}s`
      : `${Math.ceil(remaining)}s`;

  // 재료가 바뀔 때마다 food가 주문서 컬럼 영역을 넘으면 너비를 줄여서 축소
  useEffect(() => {
    const container = containerRef.current;
    const food = foodRef.current;
    if (!container || !food) return;

    food.style.width = "100%";
    food.style.margin = "";

    // ingame__play-area: flex:1 + min-height:0으로 definite height를 가짐
    // ingame__order-col은 align-self:center(auto height)라 측정 기준으로 부적합
    const playArea = container.closest('.ingame__play-area');
    if (!playArea) return;

    const columnBottom = playArea.getBoundingClientRect().bottom;
    const foodTop = food.getBoundingClientRect().top;
    const availableH = columnBottom - foodTop;
    const naturalH = food.scrollHeight;

    if (naturalH > availableH && availableH > 0) {
      const scale = availableH / naturalH;
      food.style.width = `${scale * 100}%`;
      food.style.margin = "0 auto";
    }
  }, [order.ingredients, order.type]);

  return (
    <div
      className={[
        "order-preview",
        isUrgent ? "order-preview--urgent" : "",
        isFever ? "order-preview--fever" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      ref={containerRef}
    >
      {/* Header: order number + remaining time */}
      <div className="order-preview__header">
        <span className="order-preview__index">
          {isFever ? "FEVER TIME!" : `ORDER #${order.orderIndex + 1}`}
        </span>
        <span
          className={`order-preview__time${isUrgent ? " order-preview__time--urgent" : ""}`}
        >
          {remainingText}
        </span>
      </div>

      {/* Timer bar */}
      <div className="order-preview__timer-wrap">
        <div
          className={`order-preview__timer-bar${isUrgent ? " order-preview__timer-bar--urgent" : ""}`}
          style={{ width: `${timePct}%` }}
        />
      </div>

      {isFever ? (
        <div className="order-preview__fever">
          <p className="order-preview__fever-text">
            Stack as many as you can before time runs out!
          </p>
          {feverIngredient && (
            <div className="order-preview__fever-target">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={INGREDIENT_IMAGES[feverIngredient]} alt={feverIngredient} />
            </div>
          )}
          <p className="order-preview__fever-count">
            Stacked: {submittedCount}
          </p>
          <p className="order-preview__fever-score">
            Expected: +{(submittedCount * FEVER_SCORE_PER_STACK).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="order-preview__food" ref={foodRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ingredient/bun_bottom.png"
            alt="bun-bottom"
            className="order-preview__bun"
          />

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

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ingredient/bun_top.png"
            alt="bun-top"
            className="order-preview__bun order-preview__bun--top"
          />
        </div>
      )}
    </div>
  );
}
