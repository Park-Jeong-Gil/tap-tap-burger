'use client';

import { Fragment, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

export interface AttackProjectilePulse {
  id: number;
  count: number;
  type: 'combo' | 'fever_delta';
  direction: 'outgoing' | 'incoming';
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface AttackProjectileLayerProps {
  pulses: AttackProjectilePulse[];
  onDone: (id: number) => void;
}

export default function AttackProjectileLayer({
  pulses,
  onDone,
}: AttackProjectileLayerProps) {
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    for (const pulse of pulses) {
      if (timersRef.current.has(pulse.id)) continue;
      const timer = setTimeout(() => {
        onDone(pulse.id);
        timersRef.current.delete(pulse.id);
      }, 760);
      timersRef.current.set(pulse.id, timer);
    }
  }, [pulses, onDone]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
  }, []);

  return (
    <div className="attack-projectile-layer">
      <AnimatePresence>
        {pulses.map((pulse) => {
          const shotCount = Math.max(1, Math.min(3, pulse.count));

          return (
            <Fragment key={pulse.id}>
              {Array.from({ length: shotCount }).map((_, idx) => {
                const spread = (idx - (shotCount - 1) / 2) * 22;
                const arcHeight = 42 + idx * 10;
                const midX = (pulse.from.x + pulse.to.x) / 2 + spread;
                const midY = (pulse.from.y + pulse.to.y) / 2 - arcHeight;

                return (
                  <motion.div
                    key={`${pulse.id}-${idx}`}
                    className={[
                      'attack-shot',
                      `attack-shot--${pulse.type}`,
                      `attack-shot--${pulse.direction}`,
                    ].join(' ')}
                    initial={{
                      x: pulse.from.x,
                      y: pulse.from.y,
                      opacity: 0,
                      scale: 0.55,
                      rotate: -22,
                    }}
                    animate={{
                      x: [pulse.from.x, midX, pulse.to.x],
                      y: [pulse.from.y, midY, pulse.to.y],
                      opacity: [0, 1, 1, 0],
                      scale: [0.55, 1, 1, 0.78],
                      rotate: [-22, 0, 20],
                    }}
                    exit={{ opacity: 0 }}
                    transition={{
                      duration: 0.58,
                      delay: idx * 0.04,
                      times: [0, 0.38, 0.78, 1],
                      ease: 'easeOut',
                    }}
                  >
                    {idx === 0 && pulse.count > 3 && (
                      <span className="attack-shot__count">+{pulse.count}</span>
                    )}
                  </motion.div>
                );
              })}

              <motion.div
                className={`attack-impact attack-impact--${pulse.type}`}
                initial={{ x: pulse.to.x, y: pulse.to.y, scale: 0.2, opacity: 0 }}
                animate={{ scale: [0.2, 1.3, 0.9], opacity: [0, 1, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.42, delay: 0.24, times: [0, 0.5, 1] }}
              />
            </Fragment>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
