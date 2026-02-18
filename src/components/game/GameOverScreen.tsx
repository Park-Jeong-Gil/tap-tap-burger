'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useLocale } from '@/providers/LocaleProvider';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0 },
};

interface GameOverScreenProps {
  versusResult?: 'win' | 'loss';
  allowZeroScoreSave?: boolean;
}

export default function GameOverScreen({ versusResult, allowZeroScoreSave = false }: GameOverScreenProps) {
  const { t } = useLocale();
  const router = useRouter();
  const score = useGameStore((s) => s.score);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const resetGame = useGameStore((s) => s.resetGame);
  const saveScore = useGameStore((s) => s.saveScore);
  const mode = useGameStore((s) => s.mode);
  const playerId = usePlayerStore((s) => s.playerId);
  const [isNewRecord, setIsNewRecord] = useState<boolean | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) return;

    let cancelled = false;
    const runSave = async () => {
      const first = await saveScore(playerId, { allowZeroScore: allowZeroScoreSave });
      if (cancelled) return;

      if (first.reason === 'saved') {
        setIsNewRecord(first.isNewRecord);
        return;
      }

      if (first.reason === 'skipped_zero_multi') {
        return;
      }

      const second = await saveScore(playerId, { allowZeroScore: allowZeroScoreSave });
      if (cancelled) return;

      if (second.reason === 'saved') {
        setIsNewRecord(second.isNewRecord);
        return;
      }

      setToastMessage(t.saveFailed);
    };

    runSave();
    return () => {
      cancelled = true;
    };
  }, [allowZeroScoreSave, playerId, saveScore, t.saveFailed]);

  const handleRestart = () => {
    // Single restart: reset to idle so the page's countdown flow runs again.
    resetGame();
  };

  const handleHome = () => {
    router.push('/');
    // versus/coop: 게임 페이지 언마운트 cleanup effect가 resetGame/resetRoom 처리
    //   → 마운트 중 roomStatus를 'waiting'으로 바꾸면 로비가 렌더되는 플래시 발생
    // solo: 언마운트 cleanup 없으므로 여기서 직접 리셋
    if (mode !== 'versus' && mode !== 'coop') {
      requestAnimationFrame(() => resetGame());
    }
  };

  return (
    <div className="gameover-overlay">
      {/* Title */}
      <motion.h2
        className="gameover-title"
        style={versusResult === 'win' ? { color: '#F5C842' } : undefined}
        initial={{ scale: 1.6, opacity: 0, y: -20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22, delay: 0.05 }}
      >
        {versusResult === 'win' ? t.victory : versusResult === 'loss' ? t.defeat : 'GAME OVER'}
      </motion.h2>

      {/* Stats: stagger */}
      <motion.div
        className="gameover-stats"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.14, delayChildren: 0.32 }}
      >
        <motion.p variants={fadeUp} transition={{ type: 'spring', stiffness: 380, damping: 24 }}>
          SCORE <span>{score.toLocaleString()}</span>
        </motion.p>
        <motion.p variants={fadeUp} transition={{ type: 'spring', stiffness: 380, damping: 24 }}>
          MAX COMBO <span>{maxCombo}x</span>
        </motion.p>
        {isNewRecord === true && (
          <motion.p
            variants={fadeUp}
            transition={{ type: 'spring', stiffness: 380, damping: 24 }}
            style={{ color: '#2E9E3E', fontSize: '0.8em' }}
          >
            {t.newRecord}
          </motion.p>
        )}
      </motion.div>

      {toastMessage && (
        <motion.p
          className="gameover-toast"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {toastMessage}
        </motion.p>
      )}

      {/* Buttons */}
      <motion.div
        className="gameover-actions"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.72, duration: 0.3, ease: 'easeOut' }}
      >
        {mode !== 'versus' && mode !== 'coop' && (
          <button className="btn btn--primary" onClick={handleRestart}>
            {t.retry}
          </button>
        )}
        <button className="btn btn--ghost" onClick={handleHome}>
          {t.mainMenu}
        </button>
      </motion.div>
    </div>
  );
}
