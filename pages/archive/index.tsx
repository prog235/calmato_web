import { useState } from "react";
import type { GetServerSideProps } from "next";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";

import ArchiveTabs from "@/components/archive/ArchiveTabs";
import PlaylistsView from "@/components/archive/PlaylistsView";
import TracksView from "@/components/archive/TracksView";
import ThumbnailsView from "@/components/archive/ThumbnailsView";
import type { PlaylistDP } from "@/lib/types";
import { getPlaylists } from "@/lib/queries/playlists";

type Tab = "playlist" | "tracks" | "thumbnails" | "original";

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  const { data, error } = await getPlaylists(supabase);

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
  const [tab, setTab] = useState<Tab>("playlist");

  if (errorMessage) return <div>{errorMessage}</div>;

  return (
    <main className="min-h-screen px-8 sm:px-12 md:px-16 mb-16">
      {/* Header: tabs only */}
      <div className="flex justify-between items-center mb-6">
        <ArchiveTabs value={tab} onChange={setTab} />
      </div>

      {/* Body */}
      {tab === "tracks" ? (
        <TracksView playlists={playlists} />
      ) : tab === "thumbnails" ? (
        <ThumbnailsView />
      ) : (
        <PlaylistsView
          playlists={playlists}
          filter={tab === "original" ? "original" : "playlist"}
        />
      )}
    </main>
  );
}
