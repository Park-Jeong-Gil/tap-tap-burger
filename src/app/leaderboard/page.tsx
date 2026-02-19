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
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Mutable state refs — read inside callbacks to avoid stale closures
  const busyRef = useRef(false);       // true while any fetch is in-flight
  const hasMoreRef = useRef(true);
  const offsetRef = useRef(0);
  const tabRef = useRef<TabMode>(tab);

  // loadMoreRef always points to the latest loadMore closure
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Defined each render so it captures up-to-date state/refs
  const loadMore = () => {
    if (busyRef.current || !hasMoreRef.current) return;

    const offset = offsetRef.current;
    busyRef.current = true;
    setLoadingMore(true);

    getLeaderboard(tabRef.current, offset, offset + PAGE_SIZE - 1)
      .then((data) => {
        const entries = (data as unknown as LeaderEntry[]) ?? [];
        setRows((prev) => {
          const updated = [...prev, ...entries];
          offsetRef.current = updated.length;
          return updated;
        });
        const more = entries.length === PAGE_SIZE;
        setHasMore(more);
        hasMoreRef.current = more;
      })
      .catch((error) => {
        console.error("[leaderboard] failed to load more rows", {
          tab: tabRef.current,
          offset,
          error,
        });
      })
      .finally(() => {
        busyRef.current = false;
        setLoadingMore(false);

        // 더 불러올 데이터가 있고 sentinel이 여전히 뷰포트 안에 있으면 재트리거
        if (hasMoreRef.current) {
          const sentinel = sentinelRef.current;
          const obs = observerRef.current;
          if (sentinel && obs) {
            obs.unobserve(sentinel);
            obs.observe(sentinel);
          }
        }
      });
  };

  // Keep ref in sync so the observer always calls the latest function
  useEffect(() => {
    loadMoreRef.current = loadMore;
  }, [loadMore]);

  // Tab change: reset state and load first page
  useEffect(() => {
    // Reset all mutable state before new fetch
    busyRef.current = true;
    offsetRef.current = 0;
    hasMoreRef.current = true;
    setRows([]);
    setHasMore(true);
    setLoading(true);

    getLeaderboard(tab, 0, PAGE_SIZE - 1)
      .then((data) => {
        const entries = (data as unknown as LeaderEntry[]) ?? [];
        setRows(entries);
        offsetRef.current = entries.length;
        const more = entries.length === PAGE_SIZE;
        setHasMore(more);
        hasMoreRef.current = more;
      })
      .catch((error) => {
        console.error("[leaderboard] failed to load rows", { tab, error });
        setRows([]);
      })
      .finally(() => {
        busyRef.current = false;
        setLoading(false);

        // 핵심 수정: 초기 로드 완료 후 sentinel이 여전히 뷰포트 안에 있으면
        // IntersectionObserver는 교차 상태가 바뀌지 않아서 재발화하지 않는다.
        // unobserve → observe로 강제 재검사.
        const sentinel = sentinelRef.current;
        const obs = observerRef.current;
        if (sentinel && obs) {
          obs.unobserve(sentinel);
          obs.observe(sentinel);
        }
      });
  }, [tab]);

  // IntersectionObserver — 마운트 시 한 번만 설정
  // 콜백은 loadMoreRef를 통해 항상 최신 함수를 호출
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        loadMoreRef.current();
      },
      { threshold: 0 }
    );

    observerRef.current = observer;
    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
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
            const isMine = Boolean(
              playerId &&
              row.players?.id
                ?.split("|")
                .filter(Boolean)
                .includes(playerId),
            );
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

      {/* Sentinel — 항상 DOM에 유지 */}
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
