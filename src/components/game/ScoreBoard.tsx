'use client';

interface ScoreBoardProps {
  score: number;
  combo: number;
}

function getComboLevel(combo: number): string {
  if (combo >= 10) return 'combo-display--lv4';
  if (combo >= 6)  return 'combo-display--lv3';
  if (combo >= 3)  return 'combo-display--lv2';
  return 'combo-display--lv1';
}

export default function ScoreBoard({ score, combo }: ScoreBoardProps) {
  return (
    <div className="ingame__score">
      <p className="score-display">
        SCORE <span>{score.toLocaleString()}</span>
      </p>
      {combo > 0 && (
        <p className={`combo-display ${getComboLevel(combo)}`} key={combo}>
          {combo}x COMBO!
        </p>
      )}
    </div>
  );
}
