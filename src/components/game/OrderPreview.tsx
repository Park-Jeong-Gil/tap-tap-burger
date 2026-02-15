"use client";

import { useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Order, Ingredient } from "@/types";
import { useGameStore } from "@/stores/gameStore";

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

  const submitFlash = useGameStore((s) => s.submitFlash);
  const lastComboOnSubmit = useGameStore((s) => s.lastComboOnSubmit);

  const [showClear, setShowClear] = useState(false);
  const [clearId, setClearId] = useState(0);
  const [isComboFlash, setIsComboFlash] = useState(false);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 정답 제출 시 CLEAR! 플래시
  useEffect(() => {
    if (submitFlash === "correct") {
      if (clearTimer.current) clearTimeout(clearTimer.current);
      setClearId((n) => n + 1);
      setIsComboFlash(lastComboOnSubmit >= 1);
      setShowClear(true);
      clearTimer.current = setTimeout(() => setShowClear(false), 520);
    }
  }, [submitFlash, lastComboOnSubmit]);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  const remaining = Math.max(0, order.timeLimit - order.elapsed);
  const timePct = (remaining / order.timeLimit) * 100;
  const isUrgent = timePct < 30;

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
  }, [order.ingredients]);

  return (
    <div
      className={`order-preview${isUrgent ? " order-preview--urgent" : ""}`}
      ref={containerRef}
    >
      {/* 정답 제출 CLEAR! 플래시 오버레이 */}
      <AnimatePresence>
        {showClear && (
          <motion.div
            key={clearId}
            className={`order-preview__clear${isComboFlash ? " order-preview__clear--combo" : ""}`}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: 1,
              scale: 1,
              transition: { type: "spring", stiffness: 600, damping: 22 },
            }}
            exit={{
              opacity: 0,
              scale: 1.1,
              transition: { duration: 0.2, ease: "easeIn" },
            }}
          >
            CLEAR!
          </motion.div>
        )}
      </AnimatePresence>

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

      {/* 목표 버거 비주얼 */}
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
    </div>
  );
}
