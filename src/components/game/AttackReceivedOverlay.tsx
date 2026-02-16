'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';

export default function AttackReceivedOverlay() {
  const attackReceivedFlashCount = useGameStore((s) => s.attackReceivedFlashCount);
  const attackReceivedCount = useGameStore((s) => s.attackReceivedCount);
  const attackReceivedType = useGameStore((s) => s.attackReceivedType);

  const [visible, setVisible] = useState(false);
  const [count, setCount] = useState(0);
  const [uid, setUid] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (attackReceivedFlashCount === 0) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setCount(attackReceivedCount);
    setUid((n) => n + 1);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), 900);
  }, [attackReceivedFlashCount, attackReceivedCount]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* 붉은 전면 플래시 오버레이 */}
          <motion.div
            key={`overlay-${uid}`}
            className="attack-received-overlay"
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.55, 0.3, 0.5, 0],
              transition: { duration: 0.85, times: [0, 0.1, 0.3, 0.5, 1] },
            }}
            exit={{ opacity: 0 }}
          />
          {/* 경고 텍스트 */}
          <motion.div
            key={`label-${uid}`}
            className="attack-received-label"
            initial={{ opacity: 0, scale: 1.8, y: 20, rotate: 2 }}
            animate={{
              opacity: [0, 1, 1],
              scale: [1.8, 0.92, 1],
              y: [20, -4, 0],
              rotate: [2, -0.5, 0],
              transition: { duration: 0.4, times: [0, 0.48, 1] },
            }}
            exit={{
              y: -20,
              opacity: 0,
              transition: { duration: 0.25, ease: 'easeIn' },
            }}
          >
            <span className="attack-received-label__icon">⚠</span>
            <span className="attack-received-label__text">
              {attackReceivedType === 'fever_delta'
                ? `피버 우위 공격 +${count}`
                : `+${count}개 주문 추가!`}
            </span>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
