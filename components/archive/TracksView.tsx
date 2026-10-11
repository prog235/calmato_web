import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Search, X } from "lucide-react";
import styles from "@/styles/archiveTracks.module.css";
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
  const [trackSearch, setTrackSearch] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const categoryToggleRef = useRef<HTMLButtonElement>(null);

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
      .filter(
        (pl) =>
          Number(pl.category_id) === selectedCategoryId &&
          pl.show_in_category === true
      )
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

  const filteredTracks = useMemo(() => {
    const query = trackSearch.trim().toLowerCase();
    if (!query) return tracks;

    return tracks.filter((track) => {
      return [track.title, track.subtitle]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [trackSearch, tracks]);

  const selectCategory = (categoryId: number) => {
    setSelectedCategoryId(categoryId);
    setCategoriesOpen(false);
    if (categoriesOpen) categoryToggleRef.current?.focus();
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
    <div className={styles.layout}>
      {/* Left category index */}
      {!hasSingleCategory && (
        <div className={styles.categories} onKeyDown={(event) => {
          if (event.key === "Escape") {
            setCategoriesOpen(false);
            categoryToggleRef.current?.focus();
          }
        }}>
          <button
            ref={categoryToggleRef}
            type="button"
            className={`${styles.categoryToggle} ${styles.categoryButton}`}
            aria-expanded={categoriesOpen}
            aria-controls="archive-category-options"
            onClick={() => setCategoriesOpen((value) => !value)}
          >
            {activeCategory?.image_path && (
              <Image src={getThumbnailUrl(activeCategory.image_path) ?? "/thumbnails/default.png"} alt="" fill sizes="100vw" className="object-cover brightness-50" />
            )}
            <span className={styles.toggleLabel}><span className="text-[11px] font-normal text-white/65">카테고리</span><span>{activeCategory?.name}</span></span>
            <ChevronDown size={18} className={`${styles.chevron} ${categoriesOpen ? styles.rotated : ""}`} />
          </button>
          <div id="archive-category-options" className={`${styles.categoryOptions} ${categoriesOpen ? styles.optionsOpen : ""}`}>

          {sortedCategories.map((cat) => {
            const isActive = cat.id === selectedCategoryId;

            return (
              <button
                type="button"
                aria-pressed={isActive}
                key={cat.id}
                onClick={() => selectCategory(cat.id)}
                className={`${styles.categoryButton} relative h-12 w-full cursor-pointer overflow-hidden transition group ${
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
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 16vw, 50vw"
                    className={`object-cover transition ${
                      isActive
                        ? "brightness-100"
                        : "brightness-50 group-hover:brightness-75"
                    }`}
                  />
                )}

                <span className="absolute inset-0 bg-black/25" />

                <span className="absolute inset-0 flex items-center px-4 font-semibold text-[13px] text-white text-left leading-snug">
                  {cat.name}
                </span>
              </button>
            );
          })}
          </div>
        </div>
      )}

      {/* Right content */}
      <div
        className={`${styles.content} relative min-w-0 w-full border border-[var(--foreground)]/10 p-0.5 z-20 bg-[var(--background)] ${
          hasSingleCategory ? "rounded-md" : "rounded-md lg:rounded-l-none"
        }`}
        style={{
          boxShadow:
            "-12px 12px 20px -4px rgba(0,0,0,0.5), 12px 0 20px -6px rgba(0,0,0,0.15)",
        }}
      >
        <div className="rounded-sm border border-[var(--foreground)]/5">
          <div className="p-3 space-y-4 sm:p-5 lg:p-7 lg:space-y-5">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl sm:text-[22px] font-semibold text-white break-words">
                  {pageTitle}
                </h2>

                <p className="mt-1 text-[13px] text-white/45">
                  {trackCount} Tracks
                </p>
              </div>

              <div className="relative w-full sm:w-56 sm:shrink-0 lg:w-64">
                <Search
                  size={16}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                />
                <input
                  type="search"
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  placeholder="곡 검색"
                  aria-label="곡 검색"
                  className="h-11 sm:h-9 w-full rounded-md border border-white/10 bg-white/[0.055] pl-9 pr-9 text-base sm:text-[13px] text-white outline-none transition placeholder:text-white/30 hover:border-white/20 focus:border-white/35 focus:bg-white/[0.075]"
                />
                {trackSearch && (
                  <button
                    type="button"
                    onClick={() => setTrackSearch("")}
                    aria-label="검색어 지우기"
                    className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition hover:bg-white/10 hover:text-white"
                  >
                    <X size={14} strokeWidth={1.8} />
                  </button>
                )}
              </div>
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
                  className={`min-h-9 px-1 transition ${
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
                      className={`min-h-9 px-1 before:content-['·'] before:mr-3 transition ${
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
            <div className="min-h-[280px] space-y-2.5 sm:space-y-4 md:min-h-[560px]">
              {tracksLoading && (
                <div className="subtext">Loading tracks...</div>
              )}

              {tracksError && <div className="text-red-400">{tracksError}</div>}

              {!tracksLoading && !tracksError && tracks.length === 0 && (
                <div className="subtext">No tracks.</div>
              )}

              {!tracksLoading &&
                !tracksError &&
                tracks.length > 0 &&
                filteredTracks.length === 0 && (
                  <div className="subtext">No matching tracks.</div>
                )}

              {!tracksLoading &&
                !tracksError &&
                filteredTracks.map((t) => <TrackRow key={t.id} track={t} />)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
