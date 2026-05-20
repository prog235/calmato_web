import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Get all playlists
 */
export function getPlaylists(db: SupabaseClient) {
  return db
    .from("playlists")
    .select("*")
    .order("id", { ascending: true });
}

/**
 * Get one playlist by slug with nested tracks
 */
export function getPlaylistBySlugWithTracks(
  db: SupabaseClient,
  slug: string
) {
  return db
    .from("playlists")
    .select(
      `
      id,
      title,
      slug,
      thumbnail_path,
      desc_kim,
      desc_lee,
      youtube_url,
      category_id,
      playlist_tracks (
        position,
        tracks!inner (
          id, 
          title,
          subtitle
        )
      )
    `
    )
    .eq("slug", slug)
    .order("position", { foreignTable: "playlist_tracks", ascending: true })
    .maybeSingle();
}
