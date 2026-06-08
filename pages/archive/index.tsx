import { useEffect, useState } from "react";
import Image from "next/image";
import { getImage } from "@/lib/getUrl";
import { supabase } from "@/lib/supabaseClient";

import ArchiveTabs from "@/components/archive/ArchiveTabs";
import PlaylistsView from "@/components/archive/PlaylistsView";
import TracksView from "@/components/archive/TracksView";
import ThumbnailsView from "@/components/archive/ThumbnailsView";

import type { PlaylistDP } from "@/lib/types";
import { getPlaylists } from "@/lib/queries/playlists";
import { getCategories } from "@/lib/queries/categories";
import heroStyles from "@/styles/communityHero.module.css";

type Tab = "playlist" | "tracks" | "thumbnails" | "original";

type ArchiveCategory = {
  id: number;
  name: string;
  image_path?: string | null;
  created_at?: string | null;
};

const REQUEST_BANNER_SRC = getImage("assets", "banners/archive_banner.jpg");

export default function Project() {
  const [tab, setTab] = useState<Tab>("playlist");

  const [categories, setCategories] = useState<ArchiveCategory[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistDP[]>([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchArchiveData = async () => {
      setLoading(true);
      setErrorMessage(null);

      const [
        { data: categoriesData, error: categoriesError },
        { data: playlistsData, error: playlistsError },
      ] = await Promise.all([
        getCategories(supabase),
        getPlaylists(supabase),
      ]);

      if (categoriesError || playlistsError) {
        setErrorMessage(
          categoriesError?.message ?? playlistsError?.message ?? "Failed to load archive data."
        );
        setLoading(false);
        return;
      }

      setCategories((categoriesData ?? []) as ArchiveCategory[]);
      setPlaylists((playlistsData ?? []) as PlaylistDP[]);
      setLoading(false);
    };

    fetchArchiveData();
  }, []);

  if (errorMessage) return <div>{errorMessage}</div>;

  return (
    <main className="min-h-screen px-8 sm:px-12 md:px-16 mb-16">
      <section className={heroStyles.heroSection}>
        <div className={heroStyles.heroImageWrap}>
          <Image
            src={REQUEST_BANNER_SRC}
            alt="Archive banner"
            fill
            priority
            className={heroStyles.heroImage}
          />
          <div className={heroStyles.heroOverlay} />
          <div className={heroStyles.heroContent}>
            <h1>Archive</h1>
            <div className="mx-auto mb-4 h-px w-64 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
            <p>여러분과 함께 만들어간 음악들입니다</p>
            <p>영상에 담긴 마음도 함께 확인해보세요</p>
          </div>
        </div>
      </section>

      <section className={`${heroStyles.tabsSection} pb-6`}>
        <ArchiveTabs value={tab} onChange={setTab} />
      </section>

      {loading ? (
        <div className="subtext">Loading archive...</div>
      ) : tab === "tracks" ? (
        <TracksView categories={categories} playlists={playlists} />
      ) : tab === "thumbnails" ? (
        <ThumbnailsView />
      ) : tab === "playlist" ? (
        <PlaylistsView
          categories={categories}
          playlists={playlists}
          filter="playlist"
        />
      ) : (
        <div className="rounded-lg border border-[var(--foreground)]/10 p-6">
          <h2 className="text-lg font-semibold mb-2">Coming Soon...</h2>
          <p className="subtext">오리지널 컨텐츠를 준비중입니다</p>
        </div>
      )}
    </main>
  );
}
