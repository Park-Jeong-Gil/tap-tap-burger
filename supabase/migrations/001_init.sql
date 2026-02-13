-- ──────────────────────────────────────────────────────
-- Tap Tap Burger: Perfect Order — DB 초기 마이그레이션
-- Supabase SQL Editor 또는 CLI로 실행하세요.
-- ──────────────────────────────────────────────────────

-- 1. players 테이블
CREATE TABLE IF NOT EXISTS public.players (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID UNIQUE NOT NULL,
  nickname   TEXT NOT NULL DEFAULT 'player',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. scores 테이블
CREATE TABLE IF NOT EXISTS public.scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id  UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  mode       TEXT NOT NULL CHECK (mode IN ('single', 'coop', 'versus')),
  score      INTEGER NOT NULL DEFAULT 0,
  max_combo  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, mode)
);

-- 3. rooms 테이블
CREATE TABLE IF NOT EXISTS public.rooms (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode       TEXT NOT NULL CHECK (mode IN ('coop', 'versus')),
  status     TEXT NOT NULL CHECK (status IN ('waiting', 'playing', 'finished')) DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. room_players 테이블
CREATE TABLE IF NOT EXISTS public.room_players (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  player_id     UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  ready         BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_keys TEXT[] DEFAULT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, player_id)
);

-- ──────────────────────────────────────────────────────
-- 5. upsert_best_score RPC
-- 기존 최고 점수보다 높을 때만 업데이트
-- ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_best_score(
  p_player_id UUID,
  p_mode      TEXT,
  p_score     INTEGER,
  p_max_combo INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.scores (player_id, mode, score, max_combo)
  VALUES (p_player_id, p_mode, p_score, p_max_combo)
  ON CONFLICT (player_id, mode)
  DO UPDATE SET
    score     = GREATEST(scores.score,     EXCLUDED.score),
    max_combo = GREATEST(scores.max_combo, EXCLUDED.max_combo);
END;
$$;

-- ──────────────────────────────────────────────────────
-- 6. RLS 설정
-- ──────────────────────────────────────────────────────
ALTER TABLE public.players     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_players ENABLE ROW LEVEL SECURITY;

-- players: 전체 읽기 허용, 자신의 session_id로만 수정
CREATE POLICY "players_select_all"
  ON public.players FOR SELECT USING (true);

CREATE POLICY "players_insert_own"
  ON public.players FOR INSERT WITH CHECK (true);

CREATE POLICY "players_update_own"
  ON public.players FOR UPDATE USING (true);

-- scores: 전체 읽기 허용, insert/update는 RPC를 통해서만
CREATE POLICY "scores_select_all"
  ON public.scores FOR SELECT USING (true);

CREATE POLICY "scores_insert_all"
  ON public.scores FOR INSERT WITH CHECK (true);

CREATE POLICY "scores_update_all"
  ON public.scores FOR UPDATE USING (true);

-- rooms: 전체 읽기/쓰기 허용 (익명 게임이므로)
CREATE POLICY "rooms_all"
  ON public.rooms FOR ALL USING (true);

CREATE POLICY "room_players_all"
  ON public.room_players FOR ALL USING (true);

-- ──────────────────────────────────────────────────────
-- 7. Realtime 활성화
-- ──────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_players;
