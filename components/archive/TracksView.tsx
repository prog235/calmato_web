import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import TrackRow from "@/components/TrackRow";
import { supabase } from "@/lib/supabaseClient";
import { getThumbnailUrl } from "@/lib/getUrl";
import type { PlaylistDP, Track } from "@/lib/types";
import { getTracksByPlaylistId } from "@/lib/queries/tracks";
import { mapTracks } from "@/lib/mappers/track";

type Props = {
  playlists: PlaylistDP[];
};

const CATEGORY_LABEL: Record<string, string> = {
  disney: "Disney",
  ghibli: "Ghibli",
  asmr: "ASMR",
  original: "Original",
};

function normalizeCategory(cat: unknown) {
  const v = typeof cat === "string" ? cat.trim() : "";
  return v.length > 0 ? v : "Uncategorized";
}

function labelCategory(cat: string) {
  return CATEGORY_LABEL[cat] ?? cat;
}

// Heuristic: treat playlist as ASMR if category is "asmr" OR an isAsmr flag exists and is true.
function isAsmrPlaylist(pl: PlaylistDP): boolean {
  if (normalizeCategory(pl?.category) === "asmr") return true;
  if (typeof pl?.is_asmr === "boolean") return pl.is_asmr;
  return false;
}

type Selection =
  | { kind: "all"; category: string }
  | { kind: "playlist"; playlistId: string | number };

export default function TracksView({ playlists }: Props) {
  const firstPlaylist = playlists[0] ?? null;

  const [selectedCategory, setSelectedCategory] = useState<string>(
    normalizeCategory(firstPlaylist?.category)
  );

  // Default to "All" within the selected category
  const [selection, setSelection] = useState<Selection>({
    kind: "all",
    category: normalizeCategory(firstPlaylist?.category),
  });

  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);

  // Cache key -> tracks[]
  // - playlist: "pl:<id>"
  // - category all: "cat:<category>"
  const tracksCacheRef = useRef<Map<string, Track[]>>(new Map());

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const pl of playlists) set.add(normalizeCategory(pl.category));
    return Array.from(set);
  }, [playlists]);

  // Non-ASMR playlists in selected category (for tabs and "All" aggregation)
  const playlistsInSelectedCategory = useMemo(() => {
    const cat = selectedCategory;
    return playlists
      .filter((pl) => normalizeCategory(pl.category) === cat)
      .filter((pl) => !isAsmrPlaylist(pl))
      .sort((a, b) => (a.id > b.id ? 1 : -1));
  }, [playlists, selectedCategory]);

  const selectCategory = (category: string) => {
    setSelectedCategory(category);
    // When switching category, default to "All" for that category
    setSelection({ kind: "all", category });
  };

  // If playlists prop changes and current selection becomes invalid, recover safely
  useEffect(() => {
    if (!playlists.length) {
      setTracks([]);
      return;
    }

    // Ensure selectedCategory exists; otherwise set to first category
    const availableCategories = new Set(playlists.map((pl) => normalizeCategory(pl.category)));
    if (!availableCategories.has(selectedCategory)) {
      const fallbackCategory = normalizeCategory(playlists[0]?.category);
      setSelectedCategory(fallbackCategory);
      setSelection({ kind: "all", category: fallbackCategory });
      return;
    }

    // If selection is playlist but that playlist is not in current (non-asmr) list, fall back to All
    if (selection.kind === "playlist") {
      const exists = playlistsInSelectedCategory.some((pl) => pl.id === selection.playlistId);
      if (!exists) {
        setSelection({ kind: "all", category: selectedCategory });
      }
    } else {
      // Keep selection.category synced
      if (selection.category !== selectedCategory) {
        setSelection({ kind: "all", category: selectedCategory });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists, selectedCategory]);

  useEffect(() => {
    let cancelled = false;

    const setFromCacheOrFetch = async () => {
      setTracksLoading(true);
      setTracksError(null);

      const cacheKey =
        selection.kind === "playlist"
          ? `pl:${selection.playlistId}`
          : `cat:${selection.category}`;

      const cached = tracksCacheRef.current.get(cacheKey);
      if (cached) {
        setTracks(cached);
        setTracksLoading(false);
        return;
      }

      // Fetch
      try {
        if (selection.kind === "playlist") {
          const { data, error } = await getTracksByPlaylistId(
            supabase,
            selection.playlistId
          );

          if (cancelled) return;

          if (error) {
            setTracks([]);
            setTracksError(error.message);
          } else {
            const rows = mapTracks(data);
            setTracks(rows);
            tracksCacheRef.current.set(cacheKey, rows);
          }

          setTracksLoading(false);
          return;
        }

        // selection.kind === "all": aggregate all tracks across playlists in the category (non-asmr)
        const pls = playlistsInSelectedCategory;
        if (pls.length === 0) {
          setTracks([]);
          tracksCacheRef.current.set(cacheKey, []);
          setTracksLoading(false);
          return;
        }

        const results = await Promise.all(
          pls.map((pl) => getTracksByPlaylistId(supabase, pl.id))
        );

        if (cancelled) return;

        // If any error, show the first one
        const firstErr = results.find((r) => r.error)?.error;
        if (firstErr) {
          setTracks([]);
          setTracksError(firstErr.message);
          setTracksLoading(false);
          return;
        }

        // Merge + de-dup (preserve order: playlist order -> track order)
        const seen = new Set<string | number>();
        const merged: Track[] = [];

        for (const r of results) {
          const rows = mapTracks(r.data);
          for (const t of rows) {
            if (seen.has(t.id)) continue;
            seen.add(t.id);
            merged.push(t);
          }
        }

        setTracks(merged);
        tracksCacheRef.current.set(cacheKey, merged);
        setTracksLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;

        setTracks([]);
        setTracksError(
          e instanceof Error ? e.message : "Unknown error"
        );
        setTracksLoading(false);
      }

    };

    setFromCacheOrFetch();

    return () => {
      cancelled = true;
    };
  }, [selection, playlistsInSelectedCategory]);

  if (!playlists.length) {
    return <div className="subtext">No playlists.</div>;
  }

  const activeCategory = selectedCategory;

  return (
    <div className="flex gap-3">
      {/* Sidebar: Categories */}
      <div className="w-1/5 space-y-2">
        {categories.map((cat) => {
          const isActive = cat === activeCategory;

          return (
            <div
              key={cat}
              onClick={() => selectCategory(cat)}
              className={`relative h-12 w-full cursor-pointer rounded-l-lg overflow-hidden transition transform group 
                ${
                  isActive
                    ? "bg-[var(--hover-background)] z-30"
                    : "bg-[var(--foreground)]/50 opacity-90 z-10 hover:opacity-100 card-shadow"
                }`}
            >
              <div className="absolute inset-0 flex items-center px-4 font-semibold text-sm text-white">
                {labelCategory(cat)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Content */}
      <div
        className="relative w-full border border-[var(--foreground)]/10 rounded-r-md p-0.5 z-20 bg-[var(--background)]"
        style={{
          boxShadow: "-12px 12px 20px -4px rgba(0,0,0,0.5), 12px 0 20px -6px rgba(0,0,0,0.15)",
        }}
      >
        <div className="rounded-sm border border-[var(--foreground)]/5">
          <div className="p-4 space-y-4">
            {/* Playlist tabs within the selected category + All */}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelection({ kind: "all", category: activeCategory })}
                className={`relative h-10 px-3 rounded-md border transition
                  ${
                    selection.kind === "all"
                      ? "bg-[var(--hover-background)] border-[var(--foreground)]/20"
                      : "bg-[var(--foreground)]/30 border-[var(--foreground)]/10 hover:bg-[var(--foreground)]/40"
                  }`}
              >
                <span className="text-sm font-semibold text-white">All</span>
              </button>

              {playlistsInSelectedCategory.map((pl) => {
                const isActive =
                  selection.kind === "playlist" && pl.id === selection.playlistId;

                return (
                  <button
                    key={pl.slug}
                    type="button"
                    onClick={() => setSelection({ kind: "playlist", playlistId: pl.id })}
                    className={`relative h-10 px-3 rounded-md border transition overflow-hidden
                      ${
                        isActive
                          ? "bg-[var(--hover-background)] border-[var(--foreground)]/20"
                          : "bg-[var(--foreground)]/30 border-[var(--foreground)]/10 hover:bg-[var(--foreground)]/40"
                      }`}
                    title={pl.title}
                  >
                    <span className="relative z-10 text-sm font-semibold text-white">
                      {pl.title.replace("Playlist", "").trim()}
                    </span>

                    <span className="absolute inset-0 opacity-60">
                      <Image
                        src={getThumbnailUrl(pl.thumbnail_path) ?? "/thumbnails/default.png"}
                        alt={pl.title}
                        fill
                        className={`object-cover ${isActive ? "brightness-90" : "brightness-50"}`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tracks list */}
            {tracksLoading && <div className="subtext">Loading tracks...</div>}
            {tracksError && <div className="text-red-400">{tracksError}</div>}

            {!tracksLoading && !tracksError && tracks.length === 0 && (
              <div className="subtext">No tracks.</div>
            )}

            {!tracksLoading && !tracksError && tracks.map((t) => <TrackRow key={t.id} track={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
