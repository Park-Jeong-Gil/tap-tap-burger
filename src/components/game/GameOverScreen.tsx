'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useGameStore } from '@/stores/gameStore';
import { usePlayerStore } from '@/stores/playerStore';
import { useRoomStore } from '@/stores/roomStore';
import { useLocale } from '@/providers/LocaleProvider';

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show:   { opacity: 1, y: 0 },
};

interface GameOverScreenProps {
  versusResult?: 'win' | 'loss';
}

export default function GameOverScreen({ versusResult }: GameOverScreenProps) {
  const { t } = useLocale();
  const router = useRouter();
  const score = useGameStore((s) => s.score);
  const maxCombo = useGameStore((s) => s.maxCombo);
  const resetGame = useGameStore((s) => s.resetGame);
  const saveScore = useGameStore((s) => s.saveScore);
  const mode = useGameStore((s) => s.mode);
  const playerId = usePlayerStore((s) => s.playerId);
  const resetRoom = useRoomStore((s) => s.reset);
  const [isNewRecord, setIsNewRecord] = useState<boolean | null>(null);

  useEffect(() => {
    if (!playerId) return;
    saveScore(playerId).then((newRecord) => setIsNewRecord(newRecord));
  }, [playerId, saveScore]);

  const handleRestart = () => {
    // Single restart: reset to idle so the page's countdown flow runs again.
    resetGame();
  };

  const handleHome = () => {
    // 네비게이션을 먼저 실행 — 상태 리셋보다 먼저 이동하여 로비/게임 화면 플래시 방지
    const shouldResetRoom = mode === 'versus' || mode === 'coop';
    router.push('/');
    // 다음 프레임에서 리셋: 이 시점엔 Next.js 네비게이션이 이미 커밋되어
    // 현재 페이지가 언마운트 중이므로 상태 변경이 화면에 표시되지 않음
    requestAnimationFrame(() => {
      if (shouldResetRoom) resetRoom();
      resetGame();
    });
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
