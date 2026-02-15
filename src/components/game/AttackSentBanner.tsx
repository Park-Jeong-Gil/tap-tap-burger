'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface AttackSentBannerProps {
  attackInfo: { id: number; count: number } | null;
}

export default function AttackSentBanner({ attackInfo }: AttackSentBannerProps) {
  return (
    <div className="attack-sent-wrap">
      <AnimatePresence>
        {attackInfo && (
          <motion.div
            key={attackInfo.id}
            className="attack-sent-banner"
            initial={{ x: '-50%', y: 20, opacity: 0, scale: 0.7 }}
            animate={{
              x: '-50%',
              y: 0,
              opacity: 1,
              scale: 1,
              transition: { type: 'spring', stiffness: 700, damping: 22 },
            }}
            exit={{
              x: '-50%',
              y: -24,
              opacity: 0,
              scale: 0.85,
              transition: { duration: 0.28, ease: 'easeIn' },
            }}
          >
            <span className="attack-sent-banner__bolt">⚡</span>
            <span className="attack-sent-banner__text">
              {attackInfo.count} COMBO 공격!
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
