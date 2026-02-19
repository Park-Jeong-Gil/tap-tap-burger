"use client";

import { useLocale } from "@/providers/LocaleProvider";

interface HowToPlayProps {
  onClose: () => void;
}

export default function HowToPlay({ onClose }: HowToPlayProps) {
  const { t } = useLocale();

  return (
    <div className="htp-modal" onClick={onClose}>
      <div className="htp-content" onClick={(e) => e.stopPropagation()}>
        <h2 className="htp-title">HOW TO PLAY</h2>

        <div className="htp-section">
          <p className="htp-section__title">{t.htpObjective}</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            {t.htpObjectiveDesc}
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">{t.htpControls}</p>
          {[
            ["A", t.htpVeggie],
            ["D", t.htpSauce],
            ["S", t.htpCheese],
            ["W", t.htpPatty],
            ["Q", t.htpOnion],
            ["E", t.htpTomato],
            ["Enter / Space", t.htpSubmitBurger],
            ["P", t.htpPassOrder],
          ].map(([key, label]) => (
            <div className="htp-key-row" key={key}>
              <kbd>{key}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">{t.htpCombo}</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            {t.htpComboDesc}
          </p>
          {[
            [t.htpCombo12, "×1.5"],
            [t.htpCombo35, "×2.0"],
            [t.htpCombo69, "×3.0"],
            [t.htpCombo10, "×5.0"],
          ].map(([combo, mult]) => (
            <div className="htp-key-row" key={combo}>
              <kbd>{combo}</kbd>
              <span>{mult}</span>
            </div>
          ))}
        </div>

        <div className="htp-section">
          <p className="htp-section__title">{t.htpFever}</p>
          <p
            style={{
              fontFamily: "var(--font-pixel)",
              fontSize: "0.75em",
              lineHeight: 1.8,
              color: "#7a7a9a",
            }}
          >
            {t.htpFeverDesc}
          </p>
        </div>

        <div className="htp-section">
          <p className="htp-section__title">{t.htpHp}</p>
          {[
            [t.htpCorrectSubmit, "+15"],
            [t.htpComboSubmit, "+20"],
            [t.htpWrongSubmit, "-10"],
            [t.htpTimeOut, "-20"],
            [t.htpPassOrderHp, "-10"],
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
            {t.htpHpDesc}
          </p>
        </div>

        <button
          className="btn btn--ghost"
          onClick={onClose}
          style={{ marginTop: "8px" }}
        >
          {t.close}
        </button>
      </div>
    </div>
  );
}
