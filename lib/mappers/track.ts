import type { Track } from "@/lib/types";

type TrackRow = {
  position: number;
  tracks: Track | Track[] | null;
};

function normalizeJoinedTracks(tracks: Track | Track[] | null): Track[] {
  if (!tracks) return [];
  return Array.isArray(tracks) ? tracks : [tracks];
}

export function mapTracks(rows: TrackRow[] | null | undefined): Track[] {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((row) => normalizeJoinedTracks(row.tracks));
}
