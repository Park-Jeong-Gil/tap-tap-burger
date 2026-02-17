"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { FEVER_SCORE_PER_STACK } from "@/lib/constants";
import { useLocale } from "@/providers/LocaleProvider";

export default function FeverResultPopup() {
  const { t } = useLocale();
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
          className={`fever-result${success ? " fever-result--success" : " fever-result--fail"}`}
          initial={{ opacity: 0, scale: 2.3, y: 34, rotate: -3 }}
          animate={{
            opacity: [0, 1, 1, 0],
            scale: [2.3, 0.9, 1.08, 0.96],
            y: [34, -8, 0, -16],
            rotate: [-3, 1, 0, 0],
            transition: { duration: 1.3, times: [0, 0.3, 0.65, 1] },
          }}
          exit={{
            opacity: 0,
            scale: 1.18,
            y: -20,
            transition: { duration: 0.18, ease: "easeIn" },
          }}
        >
          <p className="fever-result__title">
            {success ? "FEVER CLEAR!" : "FEVER FAIL"}
          </p>
          <p className="fever-result__stack">
            {success ? `STACK x${lastFeverResultCount}` : t.timeOut}
          </p>
          <p className="fever-result__score">
            {success ? `+${gained.toLocaleString()} SCORE` : "+0 SCORE"}
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
