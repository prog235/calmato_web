import Image from "next/image";
import Link from "next/link";
import HorizontalCarousel from "@/components/archive/HorizontalCarousel";
import { getThumbnailUrl } from "@/lib/getUrl";
import type { PlaylistDP } from "@/lib/types";

type ArchiveCategory = {
  id: number;
  name: string;
  image_path?: string | null;
  created_at?: string | null;
};

type Props = {
  categories: ArchiveCategory[];
  playlists: PlaylistDP[];
  filter: "playlist" | "original";
};

export default function PlaylistsView({
  categories,
  playlists,
  filter,
}: Props) {
  const filtered =
    filter === "original" ? playlists.filter((p) => !p.is_asmr) : playlists;

  const grouped = categories
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((category) => {
      const items = filtered
        .filter((pl) => Number(pl.category_id) === Number(category.id))
        .sort((a, b) => Number(a.id) - Number(b.id));

      return {
        category,
        items,
      };
    })
    .filter(({ items }) => items.length > 0);

  return (
    <div className="space-y-10">
      {grouped.map(({ category, items }) => (
        <section key={category.id}>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-[16px] font-semibold">{category.name}</h2>
          </div>

          <HorizontalCarousel>
            {items.map((pl) => {
              const thumb =
                getThumbnailUrl(pl.thumbnail_path) ??
                "/thumbnails/default.png";

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
                        <div className="relative flex flex-col items-center text-center">
                          <p className="text-white text-[13px] font-semibold leading-snug">
                            {pl.title.replace("Playlist", "").trim()}
                          </p>

                          <p className="text-white/70 text-[12px] mt-1">
                            {pl.track_n} Tracks
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