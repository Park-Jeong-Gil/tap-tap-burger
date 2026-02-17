"use client";

interface HowToPlayProps {
  onClose: () => void;
}

export default function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <div className="htp-modal" onClick={onClose}>
      <div className="htp-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="htp-title">HOW TO PLAY</h2>

        <div className="htp-section">
          <p className="htp-section__title">📋 OBJECTIVE</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            Press ingredients in order shown on the ticket to build a burger, then submit!
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">⌨️ CONTROLS</p>
          {[
            ["A", "Veggie"],
            ["D", "Sauce"],
            ["S", "Cheese"],
            ["W", "Patty"],
            ["Q", "Onion"],
            ["E", "Tomato"],
            ["Enter / Space", "Submit Burger"],
          ].map(([key, label]) => (
            <div className="htp-key-row" key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">⚡ COMBO</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            Submit within 65% of the time limit for a combo! More combos = higher score.
          </p>
          {[
            ["1-2 Combo", "×1.5"],
            ["3-5 Combo", "×2.0"],
            ["6-9 Combo", "×3.0"],
            ["10+ Combo", "×5.0"],
          ].map(([combo, mult]) => (
            <div className="htp-key-row" key={combo}>
              <kbd>{combo}</kbd>
              <span>{mult}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">🔥 FEVER</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            Every 5 successes triggers FEVER! Tap the highlighted ingredient for 6 seconds to stack points.
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">❤️ HP</p>
          {[
            ["Correct Submit", "+15"],
            ["Combo Submit", "+20"],
            ["Wrong Submit", "-10"],
            ["Time Out", "-20"],
          ].map(([action, delta]) => (
            <div className="htp-key-row" key={action}>
              <kbd>{action}</kbd>
              <span>{delta}</span>
            </div>
          ))}
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
              marginTop: "4px",
            }}
          >
            HP drains over time. Game over at 0!
          </p>
        </div>

        <button
          className="btn btn--ghost"
          onClick={onClose}
          style={{ marginTop: "8px" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
