// pages/playlists-test.tsx
import type { GetServerSideProps } from "next";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";

type PlaylistRow = {
  id: string | number;
  title: string;
  slug: string;
  created_at?: string | null;
};

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  // 1) 연결/조회 테스트: playlists 테이블에서 10개만 가져오기
  const { data, error } = await supabase
    .from("playlists")
    .select("id,title,slug,created_at")
    .order("id", { ascending: true })
    .limit(10);

  return {
    props: {
      playlists: (data ?? []) as PlaylistRow[],
      errorMessage: error?.message ?? null,
    },
  };
};

export default function PlaylistsTestPage({
  playlists,
  errorMessage,
}: {
  playlists: PlaylistRow[];
  errorMessage: string | null;
}) {
  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Supabase Playlists Test (SSR)</h1>

      <div style={{ marginTop: 12 }}>
        <b>Error:</b> {errorMessage ?? "null"}
      </div>

      <div style={{ marginTop: 12 }}>
        <b>Count:</b> {playlists.length}
      </div>

      <ul style={{ marginTop: 16, lineHeight: 1.8 }}>
        {playlists.map((p) => (
          <li key={String(p.id)}>
            <b>{p.title}</b> — {p.slug}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 20, opacity: 0.7 }}>
        이 페이지는 getServerSideProps에서 Supabase로 playlists를 가져옵니다.
      </p>
    </main>
  );
}
