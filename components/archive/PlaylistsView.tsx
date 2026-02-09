import Image from "next/image";
import Link from "next/link";
import HorizontalCarousel from "@/components/archive/HorizontalCarousel";
import { getThumbnailUrl } from "@/lib/getUrl";
import type { PlaylistDP } from "@/lib/types";

type Props = {
  playlists: PlaylistDP[];
  // "playlist" => all, "original" => !is_asmr
  filter: "playlist" | "original";
};

export default function PlaylistsView({ playlists, filter }: Props) {
  const filtered =
    filter === "original" ? playlists.filter((p) => !p.is_asmr) : playlists;

  // group by category
  const grouped = (() => {
    const map = new Map<string, PlaylistDP[]>();

    for (const pl of filtered) {
      const key = pl.category?.trim() || "Etc";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(pl);
    }

    // category 내 정렬: id 오름차순
    for (const [key, arr] of map.entries()) {
      arr.sort((a, b) => Number(a.id) - Number(b.id));
      map.set(key, arr);
    }

    const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return sortedKeys.map((k) => ({ category: k, items: map.get(k)! }));
  })();

  return (
    <div className="space-y-10">
      {grouped.map(({ category, items }) => (
        <section key={category}>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[16px] font-semibold">{category}</h2>
          </div>

          <HorizontalCarousel>
            {items.map((pl) => {
              const thumb =
                getThumbnailUrl(pl.thumbnail_path) ?? "/thumbnails/default.png";

              return (
                <Link key={pl.slug} href={`/archive/${pl.slug}`}>
                  <div className="w-[300px] shrink-0">
                    <div className="relative h-[300px] rounded-lg overflow-hidden card-shadow group">
                      <Image
                        src={thumb}
                        alt={pl.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {pl.is_asmr && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span
                            className="text-white font-semibold tracking-[0.25em] text-[22px]"
                            style={{
                              opacity: 0.85,
                              textShadow: "0 2px 14px rgba(0,0,0,0.65)",
                            }}
                          >
                            ASMR
                          </span>
                        </div>
                      )}

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
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </HorizontalCarousel>
        </section>
      ))}
    </div>
  );
}
