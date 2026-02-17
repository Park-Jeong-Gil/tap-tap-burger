"use client";

import { useEffect, useRef, useState } from "react";
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

const PAGE_SIZE = 10;

export default function LeaderboardPage() {
  const router = useRouter();
  const playerId = usePlayerStore((s) => s.playerId);
  const { t, locale } = useLocale();
  const [tab, setTab] = useState<TabMode>("single");
  const [rows, setRows] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // refs to avoid stale closures in IntersectionObserver callback
  const loadingRef = useRef(true);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);
  const tabRef = useRef<TabMode>(tab);
  const rowCountRef = useRef(0);

  tabRef.current = tab;

  // Tab change: reset and load first page
  useEffect(() => {
    setRows([]);
    rowCountRef.current = 0;
    hasMoreRef.current = true;
    setHasMore(true);
    setLoading(true);
    loadingRef.current = true;

    getLeaderboard(tab, 0, PAGE_SIZE - 1)
      .then((data) => {
        const entries = (data as unknown as LeaderEntry[]) ?? [];
        setRows(entries);
        rowCountRef.current = entries.length;
        const more = entries.length === PAGE_SIZE;
        setHasMore(more);
        hasMoreRef.current = more;
      })
      .catch(() => setRows([]))
      .finally(() => {
        setLoading(false);
        loadingRef.current = false;
      });
  }, [tab]);

  // IntersectionObserver — set up once, reads mutable state via refs
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        if (loadingRef.current || loadingMoreRef.current || !hasMoreRef.current) return;

        const offset = rowCountRef.current;
        loadingMoreRef.current = true;
        setLoadingMore(true);

        getLeaderboard(tabRef.current, offset, offset + PAGE_SIZE - 1)
          .then((data) => {
            const newEntries = (data as unknown as LeaderEntry[]) ?? [];
            setRows((prev) => {
              const updated = [...prev, ...newEntries];
              rowCountRef.current = updated.length;
              return updated;
            });
            const more = newEntries.length === PAGE_SIZE;
            setHasMore(more);
            hasMoreRef.current = more;
          })
          .catch(() => {})
          .finally(() => {
            loadingMoreRef.current = false;
            setLoadingMore(false);
          });
      },
      { threshold: 0.5 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

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

      {/* Sentinel always in DOM so IntersectionObserver survives tab switches */}
      <div ref={sentinelRef} style={{ height: "1px" }} />

      {loadingMore && (
        <p
          style={{
            fontFamily: "Mulmaru",
            color: "#7a7a9a",
            textAlign: "center",
            marginTop: "8px",
            paddingBottom: "16px",
          }}
        >
          {t.loading}
        </p>
      )}

      {!hasMore && rows.length > 0 && !loadingMore && !loading && (
        <p
          style={{
            fontFamily: "Mulmaru",
            color: "#7a7a9a",
            textAlign: "center",
            marginTop: "8px",
            paddingBottom: "16px",
            fontSize: "12px",
          }}
        >
          —
        </p>
      )}
    </div>
  );
}
