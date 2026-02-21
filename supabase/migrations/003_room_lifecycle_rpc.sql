-- ──────────────────────────────────────────────────────
-- Room lifecycle RPCs
-- - Join validation: waiting + not expired(10m) + max 2 players
-- - Start validation: waiting + not expired(10m) + exactly 2 ready players
-- ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.join_room_if_available(
  p_room_id UUID,
  p_player_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_player_count INTEGER;
BEGIN
  SELECT *
  INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_room.status <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting');
  END IF;

  IF v_room.created_at < (NOW() - INTERVAL '10 minutes') THEN
    UPDATE public.rooms
    SET status = 'finished'
    WHERE id = p_room_id AND status = 'waiting';
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_id = p_room_id
      AND player_id = p_player_id
  ) THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_joined');
  END IF;

  SELECT COUNT(*)
  INTO v_player_count
  FROM public.room_players
  WHERE room_id = p_room_id;

  IF v_player_count >= 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'room_full');
  END IF;

  INSERT INTO public.room_players (room_id, player_id, ready)
  VALUES (p_room_id, p_player_id, false);

  RETURN jsonb_build_object('ok', true, 'reason', 'joined');
END;
$$;

CREATE OR REPLACE FUNCTION public.start_room_if_ready(
  p_room_id UUID,
  p_player_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room public.rooms%ROWTYPE;
  v_player_count INTEGER;
  v_ready_count INTEGER;
BEGIN
  SELECT *
  INTO v_room
  FROM public.rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  IF v_room.status <> 'waiting' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_waiting');
  END IF;

  IF v_room.created_at < (NOW() - INTERVAL '10 minutes') THEN
    UPDATE public.rooms
    SET status = 'finished'
    WHERE id = p_room_id AND status = 'waiting';
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.room_players
    WHERE room_id = p_room_id
      AND player_id = p_player_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_member');
  END IF;

  SELECT COUNT(*)
  INTO v_player_count
  FROM public.room_players
  WHERE room_id = p_room_id;

  IF v_player_count <> 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_full');
  END IF;

  SELECT COUNT(*)
  INTO v_ready_count
  FROM public.room_players
  WHERE room_id = p_room_id
    AND ready = true;

  IF v_ready_count <> 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_ready');
  END IF;

  UPDATE public.rooms
  SET status = 'playing'
  WHERE id = p_room_id
    AND status = 'waiting';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_started');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', 'started');
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_room_if_available(UUID, UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_room_if_ready(UUID, UUID) TO anon, authenticated;

