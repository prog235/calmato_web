import { supabase } from "@/lib/supabaseClient";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaThLarge, FaList } from "react-icons/fa";
import TrackRow from "@/components/TrackRow";
import type { GetServerSideProps } from "next";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { getThumbnailUrl } from "@/lib/getUrl";

type PlaylistDP = {
  id: string | number;
  title: string;
  slug: string;
  thumbnail_path: string;
  category: string;
  is_asmr: boolean;
};

type Track = {
  id: string | number;
  title: string;
  subtitle: string;
  thumbnail_path: string;
  audio_path: string;
  desc_kim: string;
  desc_lee: string;
  youtube_url: string;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  const { data, error } = await supabase
    .from("playlists")
    .select(
      `
      id,
      title,
      slug,
      thumbnail_path,
      category,
      is_asmr
    `
    )
    .order("id", { ascending: true });

  return {
    props: {
      playlists: (data ?? []) as PlaylistDP[],
      errorMessage: error?.message ?? null,
    },
  };
};

export default function Project({
  playlists,
  errorMessage,
}: {
  playlists: PlaylistDP[];
  errorMessage: string | null;
}) {
  const [filter, setFilter] = useState<string>("playlist");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlists[0]); // 기본 선택

  const isTrack = filter === "tracks";

  const [tracks, setTracks] = useState<Track[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);

  // ✅ (선택) 캐시: 같은 플리 다시 누르면 재요청 없이 즉시 표시
  const tracksCacheRef = useRef<Map<string | number, Track[]>>(new Map());

  useEffect(() => {
    if (!selectedPlaylist?.id) return;

    const playlistId = selectedPlaylist.id;

    const cached = tracksCacheRef.current.get(playlistId);
    if (cached) {
      setTracks(cached);
      return;
    }

    let cancelled = false;

    const fetchTracks = async () => {
      setTracksLoading(true);
      setTracksError(null);

      const { data, error } = await supabase
        .from("tracks")
        .select("id, title, subtitle, thumbnail_path, audio_path, desc_kim, desc_lee, youtube_url")
        .eq("playlist_id", playlistId)
        .order("id", { ascending: true });

      if (cancelled) return;

      if (error) {
        setTracks([]);
        setTracksError(error.message);
      } else {
        const rows = (data ?? []) as Track[];
        setTracks(rows);
        tracksCacheRef.current.set(playlistId, rows);
      }

      setTracksLoading(false);
    };

    fetchTracks();

    return () => {
      cancelled = true;
    };
  }, [selectedPlaylist?.id]);

  // -----------------------------
  // ✅ 1) 필터링: playlist / original / tracks
  //    - original은 "is_asmr === false"로 해석 (원하시면 기준 바꿔드릴게요)
  // -----------------------------
  const filteredPlaylists = useMemo(() => {
    if (filter === "original") {
      return playlists.filter((p) => !p.is_asmr);
    }
    // "playlist"는 전체
    return playlists;
  }, [filter, playlists]);

  // -----------------------------
  // ✅ 2) category로 그룹핑 (Disney, Ghibli ...)
  // -----------------------------
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, PlaylistDP[]>();

    for (const pl of filteredPlaylists) {
      const key = pl.category?.trim() || "Etc";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pl);
    }

    // (선택) 카테고리 안에서 id 기준 정렬
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => Number(a.id) - Number(b.id));
      map.set(key, arr);
    }

    // (선택) 카테고리 순서: 알파벳 / 원하는 순서로 바꿀 수 있음
    const sortedKeys = Array.from(map.keys()).sort((a, b) =>
      a.localeCompare(b)
    );

    return sortedKeys.map((k) => ({
      category: k,
      items: map.get(k)!,
    }));
  }, [filteredPlaylists]);

  if (errorMessage) return <div>{errorMessage}</div>;

  return (
    <main className="min-h-screen px-8 sm:px-12 md:px-16 mb-16">
      {/* 카테고리 필터 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-6 text-[16px]">
          {["playlist", "tracks", "original"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`capitalize ${
                filter === cat ? "font-bold border-b" : "subtext"
              } hover:opacity-70 transition`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 토글 버튼 (tracks 탭 제외) */}
        <div className="h-8 flex justify-end">
          {!isTrack && (
            <div className="flex space-x-2 transition">
              <button
                onClick={() => setViewMode("grid")}
                className="p-2 rounded transition"
                style={
                  viewMode === "grid"
                    ? {
                        backgroundColor: "var(--foreground)",
                        color: "var(--background)",
                      }
                    : { color: "var(--foreground)" }
                }
              >
                <FaThLarge />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="p-2 rounded transition"
                style={
                  viewMode === "list"
                    ? {
                        backgroundColor: "var(--foreground)",
                        color: "var(--background)",
                      }
                    : { color: "var(--foreground)" }
                }
              >
                <FaList />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tracks 탭 UI (기존 유지) */}
      {isTrack ? (
        <div className="flex">
          <div className="w-1/5 space-y-2">
            {playlists.map((pl, idx) => {
              const isActive = pl.slug === selectedPlaylist.slug;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPlaylist(pl)}
                  className={`relative h-14 w-full cursor-pointer rounded-l-lg overflow-hidden transition transform group 
                    ${
                      isActive
                        ? "bg-[var(--hover-background)] z-30"
                        : "bg-[var(--foreground)]/50 opacity-90 z-10 hover:opacity-100 card-shadow"
                    }`}
                >
                  <Image
                    src={
                      getThumbnailUrl(pl.thumbnail_path) ??
                      "/thumbnails/default.png"
                    }
                    alt={pl.title}
                    fill
                    className={`object-cover transition ${
                      isActive
                        ? "brightness-100"
                        : "brightness-40 group-hover:brightness-90"
                    }`}
                  />
                  <div className="absolute inset-0 flex items-center px-4 font-semibold text-sm text-white">
                    {pl.title.replace("Playlist", "").trim()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="relative w-full border border-[var(--foreground)]/10 rounded-r-md p-0.5 z-20 bg-[var(--background)]"
            style={{
              boxShadow:
                "-12px 12px 20px -4px rgba(0,0,0,0.5), 12px 0 20px -6px rgba(0,0,0,0.15)",
            }}
          >
            <div className="rounded-sm border border-[var(--foreground)]/5">
              <div className="relative flex-col p-4 space-y-4 border-0 rounded-l-lg">
                {tracksLoading && (
                  <div className="subtext">Loading tracks...</div>
                )}
                {tracksError && (
                  <div className="text-red-400">{tracksError}</div>
                )}

                {!tracksLoading &&
                  !tracksError &&
                  tracks.map((track) => <TrackRow key={track.id} track={track} />)}
              </div>
            </div>
          </div>
        </div>
      ) : viewMode === "list" ? (
        // -----------------------------
        // ✅ list 모드는 기존 세로 리스트 스타일 유지 (원하면 이것도 카테고리별로 묶어드릴게요)
        // -----------------------------
        <div className="flex flex-col gap-3">
          {filteredPlaylists.map((playlist) => (
            <Link key={playlist.slug} href={`/project/${playlist.slug}`}>
              <div className="card-shadow flex items-center space-x-4 h-24 custom-hover-bg group relative rounded overflow-hidden transition">
                <div className="relative overflow-hidden w-[200px] h-full flex-shrink-0">
                  <Image
                    src={
                      getThumbnailUrl(playlist.thumbnail_path) ??
                      "/thumbnails/default.png"
                    }
                    alt={playlist.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute right-0 top-0 h-full w-[20px] bg-gradient-to-r from-transparent to-[var(--background)] group-hover:to-[var(--hover-background)]" />
                </div>

                <div className="pl-2">
                  <p className="font-semibold">{playlist.title}</p>
                  <p className="text-sm subtext">{playlist.category}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        // -----------------------------
        // ✅ grid 모드: 카테고리 헤더 + 가로 스크롤 캐러셀
        // -----------------------------
        <div className="space-y-10">
          {groupedByCategory.map(({ category, items }) => (
            <section key={category}>
              {/* 3) 헤더 */}
              <div className="mb-4 flex items-end justify-between">
                <h2 className="text-[16px] font-semibold">{category}</h2>
              </div>

              {/* 4) 가로 스크롤 */}
              <div
                className="
                  flex gap-4 overflow-x-auto pb-3
                  scroll-smooth hide-scrollbar horizontal-scroll-lock
                "
                onWheelCapture={(e) => {
                  e.preventDefault(); // ✅ 세로 스크롤 완전 차단
                  const el = e.currentTarget;

                  const atStart = el.scrollLeft <= 0;
                  const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;

                  // 위로 휠(음수): 왼쪽으로 가고 싶음
                  // 아래로 휠(양수): 오른쪽으로 가고 싶음
                  const goingLeft = e.deltaY < 0;

                  // 아직 가로로 더 갈 수 있으면, 세로 스크롤을 가로로 전환 + 기본 세로 스크롤 막기
                  if ((!atStart && goingLeft) || (!atEnd && !goingLeft)) {
                    el.scrollLeft += 2 * e.deltaY;
                    }
                  }
                }
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {items.map((pl) => {
                  const thumb =
                    getThumbnailUrl(pl.thumbnail_path) ??
                    "/thumbnails/default.png";

                  return (
                    <Link key={pl.slug} href={`/project/${pl.slug}`}>
                      {/* 5) 카드 크기 살짝 줄임: w-[180px] h-[180px] */}
                      <div className="w-[300px] shrink-0">
                        <div className="relative h-[300px] rounded-lg overflow-hidden card-shadow group">
                          <Image
                            src={thumb}
                            alt={pl.title}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                          />

                          {/* 1) is_asmr면 중앙 ASMR 워터마크 */}
                          {pl.is_asmr && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                              <span
                                className="
                                  text-white font-semibold tracking-[0.25em]
                                  text-[22px]
                                "
                                style={{ opacity: 0.85, textShadow: "0 2px 14px rgba(0,0,0,0.65)" }}
                              >
                                ASMR
                              </span>
                            </div>
                          )}

                          {/* 2) 이미지 하단 내부에 타이틀 오버레이 */}
                          <div className="absolute inset-x-0 bottom-0 p-3">
                            <div
                              className="absolute inset-x-0 bottom-0 h-20"
                              style={{
                                background:
                                  "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0))",
                              }}
                            />
                            <div className="relative">
                              <p className="text-white text-[13px] font-semibold leading-snug">
                                {pl.title.replace("Playlist", "").trim()}
                              </p>
                              {/* 필요하면 track count 등 추가 가능 */}
                              {/* <p className="text-white/80 text-[12px]">12 Tracks</p> */}
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
