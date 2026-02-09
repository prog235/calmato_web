// lib/mappers/album.ts
import type { Album, TrackDP } from "@/lib/types";

type TrackJoinRow = {
  position: number;
  tracks: TrackDP[]; 
};

type PlaylistRow = {
  id: string | number;
  title: string;
  slug: string;
  thumbnail_path: string;
  desc_kim: string;
  desc_lee: string;
  youtube_url: string;
  playlist_tracks: TrackJoinRow[];
};

/**
 * Supabase playlist row -> Album
 */
export function mapPlaylistRowToAlbum(row: PlaylistRow): Album {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    thumbnail: row.thumbnail_path,
    desc_kim: row.desc_kim,
    desc_lee: row.desc_lee,
    youtube_url: row.youtube_url,
    tracks: mapPlaylistTracks(row.playlist_tracks),
  };
}

/**
 * playlist_tracks[] -> TrackDP[]
 */
export function mapPlaylistTracks(playlistTracks: TrackJoinRow[] | null | undefined): TrackDP[] {
  if (!Array.isArray(playlistTracks)) return [];

  return playlistTracks
    .flatMap((pt) => pt.tracks)
}
