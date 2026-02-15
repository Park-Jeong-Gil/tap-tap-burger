'use client';

interface ScoreBoardProps {
  score: number;
}

export default function ScoreBoard({ score }: ScoreBoardProps) {
  return (
    <div className="ingame__score">
      <p className="score-display">
        SCORE <span key={score} className="score-display__value">{score.toLocaleString()}</span>
      </p>
    </div>
  );
}
