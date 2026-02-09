import type { SupabaseClient } from "@supabase/supabase-js";

export function getTracksByPlaylistId(
  db: SupabaseClient,
  playlistId: string | number
) {
  return db
    .from("playlist_tracks")
    .select(`
      position,
      tracks (
        id,
        title,
        subtitle,
        thumbnail_path,
        audio_path,
        youtube_url,
        desc_kim,
        desc_lee
      )
    `)
    .eq("playlist_id", playlistId)
    .order("position", { ascending: true });
}
