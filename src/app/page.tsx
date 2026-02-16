"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlayerStore } from "@/stores/playerStore";
import HowToPlay from "@/components/ui/HowToPlay";

export default function MainPage() {
  const router = useRouter();
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
      <div>
        <h1 className="main-title">
          TAP TAP
          <br />
          BURGER
        </h1>
        <p className="main-subtitle">Perfect Order</p>
      </div>

      <div className="main-nickname">
        <label className="main-nickname__label" htmlFor="nickname">
          닉네임
        </label>
        <input
          id="nickname"
          className="input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={handleNicknameBlur}
          placeholder="닉네임 입력..."
          maxLength={20}
        />
      </div>

      <nav className="main-menu">
        <button className="btn btn--primary" onClick={handleSingle}>
          SINGLE GAME
        </button>
        <button className="btn btn--secondary" onClick={handleMulti}>
          MULTI GAME
        </button>
        <button
          className="btn btn--tertiary"
          onClick={() => router.push("/leaderboard")}
        >
          LEADERBOARD
        </button>
        <button className="btn btn--ghost" onClick={() => setShowHtp(true)}>
          HOW TO PLAY
        </button>
      </nav>

      {showHtp && <HowToPlay onClose={() => setShowHtp(false)} />}
    </main>
  );
}
