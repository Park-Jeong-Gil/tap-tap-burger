import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Player ───────────────────────────────────────────
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

// ─── Score (keep only best score) ─────────────────────
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

// ─── Leaderboard ──────────────────────────────────────
export async function getLeaderboard(mode: string, from = 0, to = 9) {
  const { data, error } = await supabase
    .from('scores')
    .select('id, score, max_combo, created_at, players(id, nickname)')
    .eq('mode', mode)
    .order('score', { ascending: false })
    .range(from, to);

  if (error) throw error;
  return data;
}

// ─── Room ─────────────────────────────────────────────
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

export async function getRoomHostNickname(roomId: string): Promise<string> {
  const { data } = await supabase
    .from('room_players')
    .select('players(nickname)')
    .eq('room_id', roomId)
    .limit(1)
    .single();
  return (data?.players as unknown as { nickname: string } | null)?.nickname ?? 'Unknown';
}

// keepalive PATCH that completes even on page unload (handles tab close)
export function markRoomFinishedBeacon(roomId: string): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  fetch(`${url}/rest/v1/rooms?id=eq.${roomId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify({ status: 'finished' }),
    keepalive: true,
  }).catch(() => {});
}
