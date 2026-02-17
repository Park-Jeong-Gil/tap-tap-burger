"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useLocale } from "@/providers/LocaleProvider";
import HowToPlay from "@/components/ui/HowToPlay";

export default function MainPage() {
  const router = useRouter();
  const { t } = useLocale();
  const { nickname, setNickname, initSession, saveNickname, isInitialized } =
    usePlayerStore();
  const [showHtp, setShowHtp] = useState(false);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    initSession();
  }, [initSession]);

  useEffect(() => {
    if (isInitialized) setInputValue(nickname);
  }, [isInitialized, nickname]);

  const handleNicknameBlur = () => {
    setNickname(inputValue);
    saveNickname();
  };

  const handleSingle = () => {
    setNickname(inputValue);
    router.push("/game/single");
  };

  const handleMulti = () => {
    setNickname(inputValue);
    router.push("/game/multi");
  };

  return (
    <main className="main-page">
      <header className="main-header">
        <h1 className="main-title">
          TAPTAP
          <br />
          BURGER
        </h1>
        {/* <p className="main-subtitle">Perfect Order</p> */}
      </header>

      <div className="main-nickname">
        <label className="main-nickname__label" htmlFor="nickname">
          {t.nickname}
        </label>
        <input
          id="nickname"
          className="input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleNicknameBlur}
          placeholder={t.nicknamePlaceholder}
          maxLength={12}
        />
      </div>

      <nav className="main-menu">
        <button className="btn btn--primary" onClick={handleSingle}>
          {t.btnSingle}
        </button>
        <button className="btn btn--secondary" onClick={handleMulti}>
          {t.btnMulti}
        </button>
        <button
          className="btn btn--tertiary"
          onClick={() => router.push("/leaderboard")}
        >
          {t.btnLeaderboard}
        </button>
        <button
          className="btn btn--flat btn--how"
          onClick={() => setShowHtp(true)}
        >
          {t.btnHowToPlay}
        </button>
      </nav>

      {showHtp && <HowToPlay onClose={() => setShowHtp(false)} />}
    </main>
  );
}
