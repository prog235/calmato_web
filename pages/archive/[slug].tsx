import { useRouter } from "next/router";
import ReactPlayer from "react-player";
import DescriptionSection from "@/components/Description";
import { motion } from "framer-motion";
import { GetServerSideProps } from "next";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { getPlaylistBySlugWithTracks } from "@/lib/queries/playlists";
import type { Album } from "@/lib/types"
import { mapPlaylistRowToAlbum } from "@/lib/mappers/album";
import { useCallback, useEffect, useRef, useState } from "react";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  const slug = ctx.params?.slug;
  if (typeof slug !== "string") {
    return { notFound: true };
  }

  const { data, error } = await getPlaylistBySlugWithTracks(supabase, slug);

  if (error) {
    return {
      props: { album: null, errorMessage: error.message },
    };
  }

  if (!data) {
    return { notFound: true };
  }

  return {
    props: {
      album: mapPlaylistRowToAlbum(data),
      errorMessage: null,
    },
  };
};


export default function ProjectDetailPage({ album, errorMessage }: { album: Album | null; errorMessage: string | null }) {
  const router = useRouter();
  const trackListRef = useRef<HTMLDivElement>(null);
  const [scrollThumb, setScrollThumb] = useState({ height: 0, top: 0 });

  const updateScrollThumb = useCallback(() => {
    const trackList = trackListRef.current;
    if (!trackList) return;

    const { clientHeight, scrollHeight, scrollTop } = trackList;
    const thumbHeight = Math.max(36, (clientHeight / scrollHeight) * clientHeight);
    const maxScrollTop = scrollHeight - clientHeight;
    const maxThumbTop = clientHeight - thumbHeight;
    const thumbTop = maxScrollTop > 0
      ? (scrollTop / maxScrollTop) * maxThumbTop
      : 0;

    setScrollThumb({ height: thumbHeight, top: thumbTop });
  }, []);

  useEffect(() => {
    const trackList = trackListRef.current;
    if (!trackList) return;

    updateScrollThumb();
    const resizeObserver = new ResizeObserver(updateScrollThumb);
    resizeObserver.observe(trackList);

    return () => resizeObserver.disconnect();
  }, [album, updateScrollThumb]);

  if (router.isFallback) return <div>Loading...</div>;
  if (errorMessage) return <div>{errorMessage}</div>;
  if (!album) return <div>Not found</div>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 0, scale: 1 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.98 }}
      transition={{ duration: 2.0, ease: "easeOut" }}
      className="min-h-screen pb-24"
    >
      <div className="page-gutter mb-16">
        <h1 className="text-3xl font-bold mb-6">{album.title}</h1>

        {/* 전체 영역: 유튜브 + 설명 + 트랙 */}
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-stretch">
          {/* 왼쪽: 유튜브 + 설명 */}
          <div className="flex flex-col gap-6 w-full max-w-[700px]">
            {/* 유튜브 플레이어 */}
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg card-shadow">
              <ReactPlayer
                src={album.youtube_url}
                width="100%"
                height="100%"
                className=""
              />
            </div>

            {/* 설명 섹션 */}
            <DescriptionSection
              desc_kim={album.desc_kim}
              desc_lee={album.desc_lee}
            />
          </div>

          {/* 오른쪽: 트랙 리스트 */}
          <div className="relative w-full flex-1 lg:min-w-[500px]">
            <div
              ref={trackListRef}
              onScroll={updateScrollThumb}
              className="track-list-scrollbar space-y-3 lg:absolute lg:inset-0 lg:overflow-y-scroll lg:overscroll-contain lg:pr-5"
            >
              {album.tracks.map((track, index) => (
                <div
                  key={index}
                  className="flex items-start justify-between gap-4 border-b border-[var(--foreground)]/10 pb-3"
                >
                  {/* 왼쪽 번호 + 제목/영문 */}
                  <div className="flex items-center gap-2">
                    <span className="text-md text-gray-400 w-14 text-center">{index + 1}</span>
                    <div>
                      <h3 className="text-base font-semibold">{track.title}</h3>
                      <p className="text-sm subtext">{track.subtitle}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 hidden w-[7px] rounded-full bg-[var(--foreground)]/10 lg:block"
            >
              <div
                className="absolute inset-x-0 rounded-full bg-[var(--foreground)]/45 transition-[top] duration-100"
                style={{ height: scrollThumb.height, top: scrollThumb.top }}
              />
            </div>
          </div>
        </div>  
      </div>
    </motion.div>  
  )
};
