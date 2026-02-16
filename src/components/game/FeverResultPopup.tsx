'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { FEVER_SCORE_PER_STACK } from '@/lib/constants';

export default function FeverResultPopup() {
  const feverResultSeq = useGameStore((s) => s.feverResultSeq);
  const lastFeverResultCount = useGameStore((s) => s.lastFeverResultCount);

  if (feverResultSeq === 0) return null;

  const gained = lastFeverResultCount * FEVER_SCORE_PER_STACK;
  const success = lastFeverResultCount > 0;

  return (
    <div className="fever-result-wrap">
      <AnimatePresence>
        <motion.div
          key={feverResultSeq}
          className={`fever-result${success ? ' fever-result--success' : ' fever-result--fail'}`}
          initial={{ opacity: 0, y: 18, scale: 0.8 }}
          animate={{
            opacity: [0, 1, 1, 0],
            y: [18, 0, 0, -16],
            scale: [0.8, 1.05, 1, 0.96],
            transition: { duration: 1.2, times: [0, 0.2, 0.7, 1] },
          }}
          exit={{ opacity: 0 }}
        >
          <p className="fever-result__title">
            {success ? 'FEVER CLEAR!' : 'FEVER FAIL'}
          </p>
          <p className="fever-result__stack">
            {success ? `STACK x${lastFeverResultCount}` : '시간 초과'}
          </p>
          <p className="fever-result__score">
            {success ? `+${gained.toLocaleString()} SCORE` : '+0 SCORE'}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
