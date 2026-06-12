import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Disc3,
  FolderOpen,
  ListMusic,
  LockKeyhole,
  MessageSquareText,
  ShieldAlert,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";

type AdminHomePageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

const ADMIN_LINKS = [
  {
    href: "/admin/tracks",
    title: "Track Admin",
    description: "트랙 추가, 수정, 삭제와 오디오/썸네일 파일을 관리합니다.",
    icon: Disc3,
  },
  {
    href: "/admin/playlists",
    title: "Playlist Admin",
    description: "플레이리스트 생성과 트랙 순서를 관리합니다.",
    icon: ListMusic,
  },
  {
    href: "/admin/posts",
    title: "Post Admin",
    description: "커뮤니티 게시글 목록을 확인하고 삭제합니다.",
    icon: MessageSquareText,
  },
  {
    href: "/admin/reports",
    title: "Report Admin",
    description: "신고된 게시글과 댓글을 확인하고 처리합니다.",
    icon: ShieldAlert,
  },
  {
    href: "/admin/requests",
    title: "Request Admin",
    description: "곡 신청 순위와 상위 신청곡 업로드 날짜를 관리합니다.",
    icon: CalendarClock,
  },
  {
    href: "/admin/files",
    title: "File Admin",
    description: "공용 이미지와 업로드 파일을 조회하고 같은 경로로 교체합니다.",
    icon: FolderOpen,
  },
];

export default function AdminHomePage({ admin }: AdminHomePageProps) {
  return (
    <>
      <Head>
        <title>Admin | Calmato</title>
      </Head>

      <main className="min-h-screen bg-[#0a0a0a] px-5 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="border-b border-white/10 pb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
              <LockKeyhole size={14} strokeWidth={1.8} />
              Admin only
            </div>
            <h1 className="text-3xl font-medium tracking-normal text-white md:text-5xl">
              Admin
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
              {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 관리할 영역을
              선택해주세요.
            </p>
          </header>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ADMIN_LINKS.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="group rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/22 hover:bg-white/[0.055]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/8 text-white">
                      <Icon size={20} strokeWidth={1.8} />
                    </span>
                    <ArrowRight
                      size={18}
                      strokeWidth={1.8}
                      className="mt-1 text-white/35 transition group-hover:translate-x-0.5 group-hover:text-white/70"
                    />
                  </div>
                  <h2 className="mt-5 text-lg font-medium text-white">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {item.description}
                  </p>
                </Link>
              );
            })}
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminHomePageProps> = async (
  ctx
) => {
  const supabase = supabaseServerForGSSP(ctx);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      redirect: {
        destination: `/login?next=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, nickname, role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  return {
    props: {
      admin: {
        id: profile.id,
        nickname: profile.nickname ?? null,
      },
    },
  };
};
