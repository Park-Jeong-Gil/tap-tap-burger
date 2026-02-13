'use client';

interface ScoreBoardProps {
  score: number;
  combo: number;
}

export default function ScoreBoard({ score, combo }: ScoreBoardProps) {
  return (
    <div className="ingame__score">
      <p className="score-display">
        SCORE <span>{score.toLocaleString()}</span>
      </p>
      {combo > 0 && (
        <p className="combo-display" key={combo}>
          {combo}x COMBO!
        </p>
      )}
    </div>
  );
}
