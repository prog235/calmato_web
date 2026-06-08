import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
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

type PlaylistLayout = "carousel" | "wide";

function PlaylistCard({ playlist, layout }: { playlist: PlaylistDP; layout: PlaylistLayout }) {
  const thumb =
    getThumbnailUrl(playlist.thumbnail_path) ??
    "/thumbnails/default.png";

  return (
    <Link key={playlist.slug} href={`/archive/${playlist.slug}`}>
      <div className={layout === "wide" ? "w-full" : "w-[300px] shrink-0"}>
        <div
          className={[
            "relative overflow-hidden rounded-lg card-shadow group",
            layout === "wide" ? "aspect-video" : "h-[300px]",
          ].join(" ")}
        >
          <Image
            src={thumb}
            alt={playlist.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {playlist.is_asmr && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span
                className={[
                  "text-white font-semibold tracking-[0.25em]",
                  layout === "wide" ? "text-[26px]" : "text-[22px]",
                ].join(" ")}
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
                {playlist.title.replace("Playlist", "").trim()}
              </p>

              <p className="text-white/70 text-[12px] mt-1">
                {playlist.track_n} Tracks
              </p>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function LayoutIcon({
  active,
  type,
}: {
  active: boolean;
  type: PlaylistLayout;
}) {
  return (
    <span
      className={[
        "block border transition",
        type === "wide" ? "h-[12px] w-[22px]" : "h-[17px] w-[17px]",
        active ? "border-white" : "border-white/42",
      ].join(" ")}
    >
      {type === "wide" && (
        <span className={["mt-[8px] block h-px", active ? "bg-white" : "bg-white/42"].join(" ")} />
      )}
    </span>
  );
}

export default function PlaylistsView({
  categories,
  playlists,
  filter,
}: Props) {
  const [layout, setLayout] = useState<PlaylistLayout>("carousel");
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
            {category.id === grouped[0]?.category.id && (
              <div className="flex items-center gap-4">
                {(["wide", "carousel"] as PlaylistLayout[]).map((type) => {
                  const active = layout === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setLayout(type)}
                      className="flex h-7 items-center justify-center text-white/50 transition hover:text-white"
                      aria-label={type === "wide" ? "유튜브 비율 보기" : "기본 카드 보기"}
                      aria-pressed={active}
                      title={type === "wide" ? "유튜브 비율 보기" : "기본 카드 보기"}
                    >
                      <LayoutIcon active={active} type={type} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {layout === "wide" ? (
            <div className="grid grid-cols-1 gap-x-4 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((pl) => (
                <PlaylistCard key={pl.slug} playlist={pl} layout={layout} />
              ))}
            </div>
          ) : (
            <HorizontalCarousel>
              {items.map((pl) => (
                <PlaylistCard key={pl.slug} playlist={pl} layout={layout} />
              ))}
            </HorizontalCarousel>
          )}
        </section>
      ))}
    </div>
  );
}
