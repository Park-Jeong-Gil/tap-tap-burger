'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/stores/gameStore';
import { getComboMultiplier } from '@/lib/gameLogic';

function getComboLevel(combo: number): 1 | 2 | 3 | 4 {
  if (combo >= 10) return 4;
  if (combo >= 6) return 3;
  if (combo >= 3) return 2;
  return 1;
}

export default function ComboPopup() {
  const submitFlash = useGameStore((s) => s.submitFlash);
  const lastComboOnSubmit = useGameStore((s) => s.lastComboOnSubmit);

  const [visible, setVisible] = useState(false);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [uid, setUid] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (submitFlash === 'correct' && lastComboOnSubmit >= 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrentCombo(lastComboOnSubmit);
      setUid((n) => n + 1);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 950);
    }
  }, [submitFlash, lastComboOnSubmit]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const level = getComboLevel(currentCombo);
  const mult = getComboMultiplier(currentCombo);

  return (
    <div className="combo-popup-wrap">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={uid}
            className={`combo-popup combo-popup--lv${level}`}
            initial={{ scale: 2.4, opacity: 0, y: 8 }}
            animate={{
              scale: 1,
              opacity: 1,
              y: 0,
              transition: { type: 'spring', stiffness: 550, damping: 20 },
            }}
            exit={{
              scale: 0.65,
              opacity: 0,
              y: -20,
              transition: { duration: 0.22, ease: 'easeIn' },
            }}
          >
            <span className="combo-popup__number">{currentCombo}</span>
            <span className="combo-popup__text">COMBO!</span>
            <span className="combo-popup__mult">×{mult.toFixed(1)}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
