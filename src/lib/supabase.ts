import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── 플레이어 ─────────────────────────────────────────
export async function upsertPlayer(sessionId: string, nickname: string) {
  const { data, error } = await supabase
    .from('players')
    .upsert(
      { session_id: sessionId, nickname, updated_at: new Date().toISOString() },
      { onConflict: 'session_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── 스코어 저장 (최고 점수만 유지) ──────────────────
export async function upsertScore(
  playerId: string,
  mode: string,
  score: number,
  maxCombo: number
) {
  const { error } = await supabase.rpc('upsert_best_score', {
    p_player_id: playerId,
    p_mode: mode,
    p_score: score,
    p_max_combo: maxCombo,
  });

  if (error) throw error;
}

export async function getBestScore(playerId: string, mode: string): Promise<number | null> {
  const { data } = await supabase
    .from('scores')
    .select('score')
    .eq('player_id', playerId)
    .eq('mode', mode)
    .maybeSingle();
  return (data as { score: number } | null)?.score ?? null;
}

// ─── 리더보드 ─────────────────────────────────────────
export async function getLeaderboard(mode: string) {
  const { data, error } = await supabase
    .from('scores')
    .select('id, score, max_combo, created_at, players(id, nickname)')
    .eq('mode', mode)
    .order('score', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data;
}

// ─── 룸 ──────────────────────────────────────────────
export async function createRoom(mode: string, hostPlayerId: string) {
  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({ mode, status: 'waiting' })
    .select()
    .single();

  if (roomErr) throw roomErr;

  const { error: playerErr } = await supabase
    .from('room_players')
    .insert({ room_id: room.id, player_id: hostPlayerId, ready: false });

  if (playerErr) throw playerErr;
  return room;
}

export async function joinRoom(roomId: string, playerId: string) {
  const { data, error } = await supabase
    .from('room_players')
    .insert({ room_id: roomId, player_id: playerId, ready: false })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setPlayerReady(roomId: string, playerId: string, ready: boolean) {
  const { error } = await supabase
    .from('room_players')
    .update({ ready })
    .eq('room_id', roomId)
    .eq('player_id', playerId);

  if (error) throw error;
}

export async function updateRoomStatus(roomId: string, status: string) {
  const { error } = await supabase
    .from('rooms')
    .update({ status })
    .eq('id', roomId);

  if (error) throw error;
}

export async function getRoomPlayers(roomId: string) {
  const { data } = await supabase
    .from('room_players')
    .select('player_id, ready, players(nickname)')
    .eq('room_id', roomId);
  if (!data) return [];
  return data.map((rp) => ({
    playerId: rp.player_id as string,
    nickname: (rp.players as unknown as { nickname: string } | null)?.nickname ?? '...',
    ready: rp.ready as boolean,
  }));
}

export async function getRoomInfo(roomId: string) {
  const { data } = await supabase
    .from('rooms')
    .select('id, status')
    .eq('id', roomId)
    .maybeSingle();
  return data as { id: string; status: string } | null;
}
