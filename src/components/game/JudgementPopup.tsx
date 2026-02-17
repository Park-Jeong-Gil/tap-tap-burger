"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGameStore } from "@/stores/gameStore";

type JudgeTone = "perfect" | "good" | "clear" | "miss" | "timeout";

const JUDGE_COPY: Record<JudgeTone, { title: string; sub: string }> = {
  perfect: { title: "PERFECT!!", sub: "SUPER FAST SERVE" },
  good: { title: "GOOD!", sub: "NICE SPEED" },
  clear: { title: "CLEAR!", sub: "NICE SERVE" },
  miss: { title: "MISS!", sub: "WRONG ORDER" },
  timeout: { title: "TIME OVER", sub: "ORDER FAILED" },
};

export default function JudgementPopup() {
  const submitFlash = useGameStore((s) => s.submitFlash);
  const lastComboOnSubmit = useGameStore((s) => s.lastComboOnSubmit);
  const lastClearJudgement = useGameStore((s) => s.lastClearJudgement);
  const timeoutFlashCount = useGameStore((s) => s.timeoutFlashCount);

  const [visible, setVisible] = useState(false);
  const [uid, setUid] = useState(0);
  const [tone, setTone] = useState<JudgeTone>("clear");
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback((nextTone: JudgeTone) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setTone(nextTone);
    setUid((n) => n + 1);
    setVisible(true);
    hideTimer.current = setTimeout(() => setVisible(false), 720);
  }, []);

  useEffect(() => {
    if (submitFlash === "correct") {
      if (lastComboOnSubmit >= 1) return;
      trigger(lastClearJudgement ?? "clear");
      return;
    }
    if (submitFlash === "wrong") {
      trigger("miss");
    }
  }, [submitFlash, lastComboOnSubmit, lastClearJudgement, trigger]);

  useEffect(() => {
    if (timeoutFlashCount === 0) return;
    trigger("timeout");
  }, [timeoutFlashCount, trigger]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const copy = JUDGE_COPY[tone];

  return (
    <div className="judge-popup-wrap">
      <AnimatePresence>
        {visible && (
          <>
            {tone === "timeout" && (
              <motion.div
                key={`judge-vignette-${uid}`}
                className="timeout-vignette timeout-vignette--judge"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  transition: { duration: 0.72, times: [0, 0.3, 1] },
                  // transition: { duration: 20, times: [0, 0.3, 1] },
                }}
                exit={{ opacity: 0 }}
              />
            )}
            <motion.div
              key={`judge-${uid}`}
              className={`judge-popup judge-popup--${tone}`}
              initial={{ opacity: 0, scale: 2.3, y: 34, rotate: -3 }}
              animate={{
                opacity: [0, 1, 1, 1],
                scale: [2.3, 0.9, 1.08, 1],
                y: [34, -8, 0, 0],
                rotate: [-3, 1, 0, 0],
                transition: { duration: 0.58, times: [0, 0.44, 0.72, 1] },
                // transition: { duration: 20, times: [0, 0.44, 0.72, 1] },
              }}
              exit={{
                opacity: 0,
                scale: 1.18,
                y: -40,
                transition: { duration: 0.18, ease: "easeIn" },
                // transition: { duration: 20, ease: "easeIn" },
              }}
            >
              <span className="judge-popup__title">{copy.title}</span>
              {/* <span className="judge-popup__sub">{copy.sub}</span> */}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
