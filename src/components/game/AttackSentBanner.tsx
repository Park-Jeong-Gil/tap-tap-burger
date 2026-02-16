'use client';

import { AnimatePresence, motion } from 'framer-motion';

interface AttackSentBannerProps {
  attackInfo: { id: number; count: number; type: "combo" | "fever_delta" } | null;
}

export default function AttackSentBanner({ attackInfo }: AttackSentBannerProps) {
  return (
    <div className="attack-sent-wrap">
      <AnimatePresence>
        {attackInfo && (
          <motion.div
            key={attackInfo.id}
            className="attack-sent-banner"
            initial={{ x: '-50%', opacity: 0, scale: 1.8, y: 20, rotate: -2 }}
            animate={{
              x: '-50%',
              opacity: [0, 1, 1],
              scale: [1.8, 0.92, 1],
              y: [20, -4, 0],
              rotate: [-2, 0.5, 0],
              transition: { duration: 0.45, times: [0, 0.48, 1] },
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
              {attackInfo.type === "fever_delta"
                ? `피버 우위 공격 +${attackInfo.count}`
                : `${attackInfo.count} COMBO 공격!`}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
