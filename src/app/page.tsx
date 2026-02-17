"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import { useLocale } from "@/providers/LocaleProvider";
import { generateDefaultNickname } from "@/lib/gameLogic";
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
    console.log(
      `
%c _____         _         _____                 _
%c|     | ___  _| | ___   |   __| ___  ___  ___ | |_  ___  ___
%c|   --|| . || . || -_|  |  |  ||  _|| .'|| . ||   || -_||  _|
%c|_____||___||___||___|  |_____||_|  |__,||  _||_|_||___||_|
%c                                         |_|
📞 010-4468-7412
📧 wjdrlf5986@naver.com
`,
      "color:#22577A",
      "color:#38A3A5",
      "color:#57CC99",
      "color:#80ED99",
      "color:#99FFED",
    );
  }, [initSession]);

  useEffect(() => {
    if (isInitialized) setInputValue(nickname);
  }, [isInitialized, nickname]);

  const handleNicknameBlur = () => {
    setNickname(inputValue);
    saveNickname();
  };

  const handleSingle = () => {
    setNickname(inputValue.trim() || generateDefaultNickname());
    router.push("/game/single");
  };

  const handleMulti = () => {
    setNickname(inputValue.trim() || generateDefaultNickname());
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

      {/* 푸터 */}
      <p className="main-footer">
        © 2026 by{" "}
        <a href="https://girgir.dev" target="_blank" rel="noopener noreferrer">
          girgir
        </a>
        . All rights reserved.
      </p>
      {showHtp && <HowToPlay onClose={() => setShowHtp(false)} />}
    </main>
  );
}
