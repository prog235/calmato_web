import { Track } from "@/lib/types"

type TrackRow = {
  position: number;
  tracks: Track[];
}

export function mapTracks (row: TrackRow[] | null | undefined): Track[] {
  if (!Array.isArray(row)) return [];

  return row.flatMap(t => t.tracks)
}