"use client";

import { useEffect, useState } from "react";

const STEPS = [3, 2, 1, "GO!"] as const;
type Step = (typeof STEPS)[number];

// 숫자는 1000ms, GO!는 700ms
function stepDuration(s: Step) {
  return s === "GO!" ? 700 : 1000;
}

interface CountdownScreenProps {
  onComplete: () => void;
}

export default function CountdownScreen({ onComplete }: CountdownScreenProps) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const current = STEPS[step];
    const isLast = step === STEPS.length - 1;

    const timer = setTimeout(() => {
      if (isLast) {
        onComplete();
      } else {
        setStep((s) => s + 1);
      }
    }, stepDuration(current));

    return () => clearTimeout(timer);
  }, [step, onComplete]);

  const current = STEPS[step];
  const isGo = current === "GO!";

  return (
    <div className="countdown-overlay">
      <span
        key={step} // key 변경 → 재마운트 → 애니메이션 재실행
        className={`countdown-number${isGo ? " countdown-number--go" : ""}`}
      >
        {current}
      </span>
    </div>
  );
}
