import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import TrackRow from "@/components/TrackRow";
import { supabase } from "@/lib/supabaseClient";
import { getThumbnailUrl } from "@/lib/getUrl";
import type { PlaylistDP, Track } from "@/lib/types";
import {
  getTracksByPlaylistId,
  getTracksByCategoryId,
} from "@/lib/queries/tracks";
import { mapTracks } from "@/lib/mappers/track";

type ArchiveCategory = {
  id: number;
  name: string;
  image_path?: string | null;
};

type Props = {
  categories: ArchiveCategory[];
  playlists: PlaylistDP[];
};

type Selection =
  | { kind: "all"; categoryId: number }
  | { kind: "playlist"; playlistId: string | number };

export default function TracksView({ categories, playlists }: Props) {
  const firstCategory = categories[0] ?? null;

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    firstCategory?.id ?? null
  );

  const [selection, setSelection] = useState<Selection | null>(
    firstCategory ? { kind: "all", categoryId: firstCategory.id } : null
  );

  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);

  const tracksCacheRef = useRef<Map<string, Track[]>>(new Map());

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.id - b.id);
  }, [categories]);

  const activeCategory = useMemo(() => {
    return sortedCategories.find((cat) => cat.id === selectedCategoryId) ?? null;
  }, [sortedCategories, selectedCategoryId]);

  const playlistsInSelectedCategory = useMemo(() => {
    if (selectedCategoryId == null) return [];

    return playlists
      .filter((pl) => Number(pl.category_id) === selectedCategoryId)
      .sort((a, b) => Number(a.id) - Number(b.id));
  }, [playlists, selectedCategoryId]);

  const selectedPlaylist = useMemo(() => {
    if (selection?.kind !== "playlist") return null;

    return (
      playlistsInSelectedCategory.find(
        (pl) => pl.id === selection.playlistId
      ) ?? null
    );
  }, [selection, playlistsInSelectedCategory]);

  const selectCategory = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setSelection({ kind: "all", categoryId });
  };

  useEffect(() => {
    if (!sortedCategories.length) {
      setTracks([]);
      setSelectedCategoryId(null);
      setSelection(null);
      return;
    }

    const exists = sortedCategories.some((cat) => cat.id === selectedCategoryId);

    if (!exists) {
      const fallback = sortedCategories[0];
      setSelectedCategoryId(fallback.id);
      setSelection({ kind: "all", categoryId: fallback.id });
      return;
    }

    if (!selection && selectedCategoryId != null) {
      setSelection({ kind: "all", categoryId: selectedCategoryId });
      return;
    }

    if (selection?.kind === "playlist") {
      const playlistExists = playlistsInSelectedCategory.some(
        (pl) => pl.id === selection.playlistId
      );

      if (!playlistExists && selectedCategoryId != null) {
        setSelection({ kind: "all", categoryId: selectedCategoryId });
      }
    }

    if (
      selection?.kind === "all" &&
      selectedCategoryId != null &&
      selection.categoryId !== selectedCategoryId
    ) {
      setSelection({ kind: "all", categoryId: selectedCategoryId });
    }
  }, [
    sortedCategories,
    selectedCategoryId,
    selection,
    playlistsInSelectedCategory,
  ]);

  useEffect(() => {
    if (!selection) return;

    let cancelled = false;

    const fetchTracks = async () => {
      setTracksLoading(true);
      setTracksError(null);

      const cacheKey =
        selection.kind === "playlist"
          ? `pl:${selection.playlistId}`
          : `cat:${selection.categoryId}`;

      const cached = tracksCacheRef.current.get(cacheKey);
      if (cached) {
        setTracks(cached);
        setTracksLoading(false);
        return;
      }

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

        const { data, error } = await getTracksByCategoryId(
          supabase,
          selection.categoryId
        );

        if (cancelled) return;

        if (error) {
          setTracks([]);
          setTracksError(error.message);
        } else {
          const rows = (data ?? []) as Track[];
          setTracks(rows);
          tracksCacheRef.current.set(cacheKey, rows);
        }

        setTracksLoading(false);
      } catch (e: unknown) {
        if (cancelled) return;

        setTracks([]);
        setTracksError(e instanceof Error ? e.message : "Unknown error");
        setTracksLoading(false);
      }
    };

    fetchTracks();

    return () => {
      cancelled = true;
    };
  }, [selection]);

  if (!sortedCategories.length) {
    return <div className="subtext">No categories.</div>;
  }

  const hasSingleCategory = sortedCategories.length === 1;
  const hasSingleSubcategory = playlistsInSelectedCategory.length <= 1;
  const showSubcategoryTabs = !hasSingleSubcategory;

  const pageTitle =
    selection?.kind === "playlist"
      ? selectedPlaylist?.title.replace("Playlist", "").trim()
      : activeCategory?.name ?? "All";

  const trackCount =
    selection?.kind === "playlist"
      ? Number(selectedPlaylist?.track_n ?? tracks.length)
      : tracks.length;

  return (
    <div className={hasSingleCategory ? "block" : "flex"}>
      {/* Left category index */}
      {!hasSingleCategory && (
        <div className="w-1/5 space-y-2">
          {sortedCategories.map((cat) => {
            const isActive = cat.id === selectedCategoryId;

            return (
              <div
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`relative h-12 w-full cursor-pointer rounded-l-lg overflow-hidden transition group ${
                  isActive
                    ? "bg-[var(--hover-background)] z-30"
                    : "bg-[var(--foreground)]/50 opacity-90 z-10 hover:opacity-100 card-shadow"
                }`}
              >
                {cat.image_path && (
                  <Image
                    src={
                      getThumbnailUrl(cat.image_path) ??
                      "/thumbnails/default.png"
                    }
                    alt={cat.name}
                    fill
                    className={`object-cover transition ${
                      isActive
                        ? "brightness-100"
                        : "brightness-50 group-hover:brightness-75"
                    }`}
                  />
                )}

                <div className="absolute inset-0 bg-black/15" />

                <div className="absolute inset-0 flex items-center px-4 font-semibold text-[13px] text-white">
                  {cat.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Right content */}
      <div
        className={`relative w-full border border-[var(--foreground)]/10 p-0.5 z-20 bg-[var(--background)] ${
          hasSingleCategory ? "rounded-md" : "rounded-r-md"
        }`}
        style={{
          boxShadow:
            "-12px 12px 20px -4px rgba(0,0,0,0.5), 12px 0 20px -6px rgba(0,0,0,0.15)",
        }}
      >
        <div className="rounded-sm border border-[var(--foreground)]/5">
          <div className="p-7 space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-[22px] font-semibold text-white">
                {pageTitle}
              </h2>

              <p className="mt-1 text-[13px] text-white/45">
                {trackCount} Tracks
              </p>
            </div>

            <div className="h-px w-full bg-[var(--foreground)]/10" />

            {/* Text playlist tabs */}
            {showSubcategoryTabs && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[13px]">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedCategoryId == null) return;
                    setSelection({
                      kind: "all",
                      categoryId: selectedCategoryId,
                    });
                  }}
                  className={`transition ${
                    selection?.kind === "all"
                      ? "text-white font-semibold"
                      : "text-white/45 hover:text-white/80"
                  }`}
                >
                  All
                </button>

                {playlistsInSelectedCategory.map((pl) => {
                  const isActive =
                    selection?.kind === "playlist" &&
                    pl.id === selection.playlistId;

                  return (
                    <button
                      key={pl.slug}
                      type="button"
                      onClick={() =>
                        setSelection({
                          kind: "playlist",
                          playlistId: pl.id,
                        })
                      }
                      className={`before:content-['·'] before:mr-3 transition ${
                        isActive
                          ? "text-white font-semibold"
                          : "text-white/45 hover:text-white/80"
                      }`}
                    >
                      {pl.title.replace("Playlist", "").trim()}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Tracks */}
            <div className="space-y-4">
              {tracksLoading && (
                <div className="subtext">Loading tracks...</div>
              )}

              {tracksError && <div className="text-red-400">{tracksError}</div>}

              {!tracksLoading && !tracksError && tracks.length === 0 && (
                <div className="subtext">No tracks.</div>
              )}

              {!tracksLoading &&
                !tracksError &&
                tracks.map((t) => <TrackRow key={t.id} track={t} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
