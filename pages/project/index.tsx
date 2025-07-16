import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import playlistsData from "@/album.json";
import { FaThLarge, FaList } from "react-icons/fa";
import SimplePlayer from "@/components/SimplePlayer";

export default function Project() {
  const [filter, setFilter] = useState<string>("playlist");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlistsData[0]); // 기본 선택

  const filteredPlaylists = playlistsData.filter(
    (playlist) => playlist.category === filter
  );

  const isAsmr = filter === "asmr";

  return (
    <main className="min-h-screen px-8 sm:px-16 md:px-32 mb-16">
      {/* 카테고리 필터 */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-6 text-[16px]">
          {["playlist", "asmr", "original"].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`capitalize ${
                filter === cat ? "font-bold border-b" : "text-gray-400"
              } hover:text-white transition`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 토글 버튼 (ASMR 제외) */}
        <div className="h-8 flex justify-end">
          {!isAsmr && (
            <div className="flex space-x-2 transition">
              <button
                onClick={() => setViewMode("grid")}
                className="p-2 rounded transition"
                style={ viewMode === "grid" ? 
                  {
                    backgroundColor: "var(--foreground)", // 배경은 전역 글자색
                    color: "var(--background)",           // 아이콘은 전역 배경색
                  } 
                  : {
                    color: "var(--foreground)",    
                    }
                }
              >
                <FaThLarge />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className="p-2 rounded transition"
                style={ viewMode === "list" ? 
                  {
                    backgroundColor: "var(--foreground)", // 배경은 전역 글자색
                    color: "var(--background)",           // 아이콘은 전역 배경색
                  } 
                  : {
                    color: "var(--foreground)",       
                    }
                }
              >
                <FaList />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ASMR 전용 사이드바 + 리스트 */}
      {isAsmr ? (
        <div className="flex">
          {/* 📒 Index-tab-style 사이드바 */}
          <div className="w-1/4 pr-6 space-y-2">
            {playlistsData.map((pl, idx) => {
              const isActive = pl.slug === selectedPlaylist.slug;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedPlaylist(pl)}
                  className={`relative h-16 w-full cursor-pointer rounded-l-lg overflow-hidden transition transform group
                    ${isActive
                      ? "bg-[var(--hover-background)] shadow-md"
                      : "bg-white/5 opacity-80 hover:opacity-100"}`}
                >
                  <Image
                    src={pl.thumbnail}
                    alt={pl.title}
                    fill
                    className="object-cover brightness-75 group-hover:brightness-100 transition"
                  />
                  <div className="absolute inset-0 flex items-center px-4 font-semibold text-sm text-white">
                    {pl.title.replace("Playlist", "").trim()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 선택된 playlist의 트랙만 보여주는 리스트 */}
          <div className="flex-1 space-y-4">
            {selectedPlaylist.tracks.map((track, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between space-x-4 bg-white/5 p-3 rounded-lg"
              >
                <div className="flex items-center">
                  <div className="relative w-16 h-16 rounded overflow-hidden">
                    <Image
                      src={track.thumbnail}
                      alt={track.title}
                      fill
                      className="object-cover"
                    />
                  </div>
      
                  <div className="pl-5">
                    <p className="font-semibold">{track.title}</p>
                    {track.movie && (
                      <p className="text-sm text-gray-400">{track.movie}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center p-6 rounded-full bg-white/10">
                  <SimplePlayer src={track.url}/>
                </div> 
        
              </div>
            ))}
          </div>
        </div>
      ) : (
        // 일반 카테고리 렌더링
        <div
          className={`grid ${
            viewMode === "grid"
              ? "gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
              : "gap-3 grid-cols-1"
          }`}
        >
          {filteredPlaylists.map((playlist) => (
            <Link key={playlist.slug} href={`/project/${playlist.slug}`}>
              <div
                className={`${
                  viewMode === "grid"
                    ? "aspect-square"
                    : "flex items-center space-x-4 h-24 custom-hover-bg"
                } group relative rounded overflow-hidden transition`}
              >
                <div
                  className={`relative overflow-hidden ${
                    viewMode === "grid"
                      ? "w-full h-full"
                      : "w-[200px] h-full flex-shrink-0"
                  }`}
                >
                  <Image
                    src={playlist.thumbnail}
                    alt={playlist.title}
                    fill
                    className={`object-cover transition-transform duration-300 ${
                      viewMode === "grid" ? "group-hover:scale-105" : ""
                    }`}
                  />

                  {/* 그라데이션 오버레이 추가 */}
                  {viewMode === "list" && (
                    <div className="absolute right-0 top-0 h-full w-[20px] bg-gradient-to-r 
                      from-transparent to-[var(--background)]
                      group-hover:to-[var(--hover-background)]"
                    />
                  )}
                </div>
                {viewMode === "list" && (
                  <div className="pl-2">
                    <p className="font-semibold">{playlist.title}</p>
                    <p className="text-sm text-gray-400">
                      {playlist.tracks.length} tracks
                    </p>
                  </div>
                )}
              </div>
              {viewMode === "grid" && (
                <p className="mt-2 font-medium text-[14px]">{playlist.title}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
