-- ──────────────────────────────────────────────────────
-- Co-op leaderboard as team entries (nickname1 | nickname2)
-- ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.coop_team_scores (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  player1_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  score      INTEGER NOT NULL DEFAULT 0,
  max_combo  INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (player1_id <> player2_id),
  UNIQUE (player1_id, player2_id)
);

CREATE OR REPLACE FUNCTION public.upsert_coop_team_score(
  p_room_id UUID,
  p_player_a_id UUID,
  p_player_b_id UUID,
  p_score INTEGER,
  p_max_combo INTEGER
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player1 UUID;
  v_player2 UUID;
BEGIN
  IF p_player_a_id = p_player_b_id THEN
    RAISE EXCEPTION 'player ids must be different';
  END IF;

  IF p_player_a_id < p_player_b_id THEN
    v_player1 := p_player_a_id;
    v_player2 := p_player_b_id;
  ELSE
    v_player1 := p_player_b_id;
    v_player2 := p_player_a_id;
  END IF;

  INSERT INTO public.coop_team_scores (room_id, player1_id, player2_id, score, max_combo)
  VALUES (p_room_id, v_player1, v_player2, p_score, p_max_combo)
  ON CONFLICT (player1_id, player2_id)
  DO UPDATE SET
    room_id = EXCLUDED.room_id,
    score = GREATEST(public.coop_team_scores.score, EXCLUDED.score),
    max_combo = GREATEST(public.coop_team_scores.max_combo, EXCLUDED.max_combo),
    updated_at = NOW();
END;
$$;

ALTER TABLE public.coop_team_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coop_team_scores_select_all" ON public.coop_team_scores;
CREATE POLICY "coop_team_scores_select_all"
  ON public.coop_team_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "coop_team_scores_insert_all" ON public.coop_team_scores;
CREATE POLICY "coop_team_scores_insert_all"
  ON public.coop_team_scores FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "coop_team_scores_update_all" ON public.coop_team_scores;
CREATE POLICY "coop_team_scores_update_all"
  ON public.coop_team_scores FOR UPDATE USING (true);

GRANT SELECT, INSERT, UPDATE ON TABLE public.coop_team_scores TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_coop_team_score(UUID, UUID, UUID, INTEGER, INTEGER) TO anon, authenticated;
