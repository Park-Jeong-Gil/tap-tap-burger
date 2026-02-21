import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

type LeaderboardRow = {
  id: string;
  score: number;
  max_combo: number;
  players: { id: string; nickname: string } | null;
};

type RoomRpcResult = {
  ok: boolean;
  reason: string;
};

function makeGuestNickname(seed: string): string {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const num = Math.abs(hash >>> 0) % 10000;
  return `player${num.toString().padStart(4, '0')}`;
}

function normalizeNicknameValue(nickname: string | null | undefined, seed: string): string {
  const trimmed = (nickname ?? '').trim();
  return trimmed.length > 0 ? trimmed : makeGuestNickname(seed);
}

// ─── Player ───────────────────────────────────────────
export async function upsertPlayer(sessionId: string, nickname: string) {
  const safeNickname = normalizeNicknameValue(nickname, sessionId);

  const { data, error } = await supabase
    .from('players')
    .upsert(
      { session_id: sessionId, nickname: safeNickname, updated_at: new Date().toISOString() },
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

export async function upsertCoopTeamScore(
  roomId: string,
  playerAId: string,
  playerBId: string,
  score: number,
  maxCombo: number,
) {
  const [player1Id, player2Id] = [playerAId, playerBId].sort();

  const { error } = await supabase.rpc('upsert_coop_team_score', {
    p_room_id: roomId,
    p_player_a_id: player1Id,
    p_player_b_id: player2Id,
    p_score: score,
    p_max_combo: maxCombo,
  });

  if (!error) return;

  // Fallback for environments where RPC execute grant/schema cache is not ready.
  const { data: existing, error: existingError } = await supabase
    .from('coop_team_scores')
    .select('id, score, max_combo')
    .eq('player1_id', player1Id)
    .eq('player2_id', player2Id)
    .maybeSingle();

  if (existingError) throw existingError;

  if (!existing) {
    const { error: insertError } = await supabase
      .from('coop_team_scores')
      .insert({
        room_id: roomId,
        player1_id: player1Id,
        player2_id: player2Id,
        score,
        max_combo: maxCombo,
      });

    if (insertError) throw insertError;
    return;
  }

  const { error: updateError } = await supabase
    .from('coop_team_scores')
    .update({
      room_id: roomId,
      score: Math.max(existing.score, score),
      max_combo: Math.max(existing.max_combo, maxCombo),
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateError) throw updateError;
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
  if (mode === 'coop') {
    const { data, error } = await supabase
      .from('coop_team_scores')
      .select('id, score, max_combo, player1_id, player2_id')
      .order('score', { ascending: false })
      .range(from, to);

    if (error) throw error;

    const teamRows = ((data ?? []) as unknown as Array<{
      id: string;
      score: number;
      max_combo: number;
      player1_id: string;
      player2_id: string;
    }>);

    // Backward compatibility:
    // legacy coop records were stored in scores(mode='coop') with single player_id only.
    if (teamRows.length === 0) {
      const { data: legacyData, error: legacyError } = await supabase
        .from('scores')
        .select('id, score, max_combo, players(id, nickname)')
        .eq('mode', 'coop')
        .order('score', { ascending: false })
        .range(from, to);

      if (legacyError) throw legacyError;

      // Legacy coop rows in `scores` don't contain teammate identity.
      // Do not render placeholder entries like "name | ?" in coop leaderboard.
      void legacyData;
      return [];
    }

    const allPlayerIds = Array.from(
      new Set(teamRows.flatMap((row) => [row.player1_id, row.player2_id]).filter(Boolean)),
    );

    const { data: players, error: playersError } = allPlayerIds.length
      ? await supabase
          .from('players')
          .select('id, nickname')
          .in('id', allPlayerIds)
      : { data: [], error: null };

    if (playersError) {
      console.error('[leaderboard] failed to load coop player nicknames', playersError);
    }

    const playerNameMap = new Map(
      ((players ?? []) as Array<{ id: string; nickname: string }>).map((player) => [
        player.id,
        player.nickname,
      ]),
    );

    const mapped = teamRows.map((row) => {
      const name1 = normalizeNicknameValue(playerNameMap.get(row.player1_id), row.player1_id);
      const name2 = normalizeNicknameValue(playerNameMap.get(row.player2_id), row.player2_id);

      return {
        id: row.id,
        score: row.score,
        max_combo: row.max_combo,
        players: {
          id: `${row.player1_id}|${row.player2_id}`,
          nickname: `${name1} | ${name2}`,
        },
      } satisfies LeaderboardRow;
    });

    return mapped;
  }

  const { data, error } = await supabase
    .from('scores')
    .select('id, score, max_combo, created_at, players(id, nickname)')
    .eq('mode', mode)
    .order('score', { ascending: false })
    .range(from, to);

  if (error) throw error;
  const rows = ((data ?? []) as unknown as Array<{
    id: string;
    score: number;
    max_combo: number;
    players: { id: string; nickname: string } | null;
  }>).map((row) => {
    if (!row.players) return row;
    return {
      ...row,
      players: {
        ...row.players,
        nickname: normalizeNicknameValue(row.players.nickname, row.players.id),
      },
    };
  });

  return rows as unknown as LeaderboardRow[];
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
  const { data, error } = await supabase.rpc('join_room_if_available', {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;

  const result = (data ?? { ok: false, reason: 'unknown' }) as RoomRpcResult;
  if (!result.ok) {
    const e = new Error(result.reason);
    (e as Error & { code?: string }).code = result.reason;
    throw e;
  }
  return result;
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

export async function startRoom(roomId: string, playerId: string) {
  const { data, error } = await supabase.rpc('start_room_if_ready', {
    p_room_id: roomId,
    p_player_id: playerId,
  });
  if (error) throw error;

  const result = (data ?? { ok: false, reason: 'unknown' }) as RoomRpcResult;
  if (!result.ok) {
    const e = new Error(result.reason);
    (e as Error & { code?: string }).code = result.reason;
    throw e;
  }
  return result;
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

export async function leaveRoom(roomId: string, playerId: string) {
  const { error } = await supabase
    .from('room_players')
    .delete()
    .eq('room_id', roomId)
    .eq('player_id', playerId);
  if (error) throw error;
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

export function leaveRoomBeacon(roomId: string, playerId: string): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return;
  const roomIdEq = encodeURIComponent(`eq.${roomId}`);
  const playerIdEq = encodeURIComponent(`eq.${playerId}`);
  fetch(`${url}/rest/v1/room_players?room_id=${roomIdEq}&player_id=${playerIdEq}`, {
    method: 'DELETE',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Prefer': 'return=minimal',
    },
    keepalive: true,
  }).catch(() => {});
}
