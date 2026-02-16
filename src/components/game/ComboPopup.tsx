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
  const lastClearJudgement = useGameStore((s) => s.lastClearJudgement);

  const [visible, setVisible] = useState(false);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [currentJudgeText, setCurrentJudgeText] = useState('COMBO!');
  const [uid, setUid] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (submitFlash === 'correct' && lastComboOnSubmit >= 1) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setCurrentJudgeText(
        lastClearJudgement === 'perfect'
          ? 'PERFECT!!'
          : lastClearJudgement === 'good'
            ? 'GOOD!'
            : 'COMBO!',
      );
      setCurrentCombo(lastComboOnSubmit);
      setUid((n) => n + 1);
      setVisible(true);
      timerRef.current = setTimeout(() => setVisible(false), 950);
    }
  }, [submitFlash, lastComboOnSubmit, lastClearJudgement]);

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
            initial={{ scale: 2.2, opacity: 0, y: 24, rotate: -3 }}
            animate={{
              scale: [2.2, 0.92, 1.08, 1],
              opacity: [0, 1, 1, 1],
              y: [24, -8, 0, 0],
              rotate: [-3, 1, 0, 0],
              transition: { duration: 0.55, times: [0, 0.45, 0.75, 1] },
            }}
            exit={{
              scale: 1.12,
              opacity: 0,
              y: -38,
              transition: { duration: 0.2, ease: 'easeIn' },
            }}
          >
            <span className="combo-popup__judge">{currentJudgeText}</span>
            <div className="combo-popup__main">
              <span className="combo-popup__number">{currentCombo}</span>
              <span className="combo-popup__text">combo</span>
            </div>
            <span className="combo-popup__mult">x{mult.toFixed(1)} SCORE</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
