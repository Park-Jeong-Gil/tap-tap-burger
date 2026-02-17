"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getLeaderboard } from "@/lib/supabase";
import { usePlayerStore } from "@/stores/playerStore";
import { useLocale } from "@/providers/LocaleProvider";
import type { GameMode } from "@/types";

type TabMode = GameMode;

interface LeaderEntry {
  id: string;
  score: number;
  max_combo: number;
  players: { id: string; nickname: string } | null;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const playerId = usePlayerStore((s) => s.playerId);
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<TabMode>("single");
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getLeaderboard(tab)
      .then((data) => setRows((data as unknown as LeaderEntry[]) ?? []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const tabLabel: Record<TabMode, string> = {
    single: t.tabSingle,
    coop: t.tabCoop,
    versus: t.tabVersus,
  };

  const rankClass = (i: number) =>
    i === 0
      ? "leaderboard-row--top1"
      : i === 1
        ? "leaderboard-row--top2"
        : i === 2
          ? "leaderboard-row--top3"
          : "";

  return (
    <div className="leaderboard-page">
      <div className="leaderboard-header">
        <h1>LEADERBOARD</h1>
        <button
          className="btn btn--ghost"
          onClick={() => router.push("/")}
          style={{ fontSize: "inherit" }}
        >
          {t.back}
        </button>
      </div>

      <div className="leaderboard-tabs">
        {(["single", "coop", "versus"] as TabMode[]).map((mode) => (
          <button
            key={mode}
            className={`leaderboard-tab${tab === mode ? " leaderboard-tab--active" : ""}`}
            onClick={() => setTab(mode)}
          >
            {tabLabel[mode]}
          </button>
        ))}
      </div>

      {loading && (
        <p
          style={{
            fontFamily: "Mulmaru",
            color: "#7a7a9a",
            textAlign: "center",
            marginTop: "32px",
          }}
        >
          {t.loading}
        </p>
      )}

      {!loading && (
        <div className="leaderboard-table">
          {rows.length === 0 && (
            <p
              style={{
                fontFamily: "Mulmaru",
                color: "#7a7a9a",
                textAlign: "center",
                marginTop: "32px",
              }}
            >
              {t.noRecords}
            </p>
          )}
          {rows.map((row, i) => {
            const isMine = playerId && row.players?.id === playerId;
            return (
              <div
                key={row.id}
                className={[
                  "leaderboard-row",
                  rankClass(i),
                  isMine ? "leaderboard-row--mine" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <span className="leaderboard-rank">
                  {i === 0
                    ? "🥇"
                    : i === 1
                      ? "🥈"
                      : i === 2
                        ? "🥉"
                        : `#${i + 1}`}
                </span>
                <span>{row.players?.nickname ?? t.unknown}</span>
                <span>{locale === "ko" ? `${row.score.toLocaleString()}${t.scoreUnit}` : `${row.score.toLocaleString()} ${t.scoreUnit}`}</span>
                <span>{row.max_combo}x</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
