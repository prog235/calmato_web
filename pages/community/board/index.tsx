// pages/community/board.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";

import PostCard from "@/components/PostCard";
import CommunityTabs from "@/components/CommunityTabs";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import {
  BOARD_PAGE_SIZE,
  countBoardPosts,
  getBoardPostsPage,
  type BoardPostRow,
} from "@/lib/queries/board";

type CardVM = {
  id: number;
  href: string;
  isLocked: boolean;

  nickname: string;
  createdAt: string;

  title: string;
  content: string;

  likeCount: number;
  commentCount: number;
  viewCount: number;

  backgroundImageUrl?: string | null;
};

type BoardPageProps = {
  loginRequired: boolean;
  next?: string;

  cards: CardVM[];
  page: number;
  totalPages: number;
  q: string;
};

const REQUEST_BANNER_SRC = "/Group 1954.jpg"

const POST_IMAGES_BUCKET = "post-images";

/**
 * posts.user_id -> profiles.id FK 이름 (Supabase Relationship에서 확인)
 */
const PROFILES_FK_NAME = "posts_user_id_fkey";

function clampExcerpt(content: string) {
  return (content ?? "").replace(/\s+/g, " ").trim();
}

export default function BoardPage(props: BoardPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState(props.q ?? "");

  useEffect(() => {
    if (!props.loginRequired) return;

    alert("로그인이 필요한 페이지입니다.");
    const next = props.next ?? "/community/board";
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [props.loginRequired, props.next, router]);

  const pages = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= props.totalPages; i += 1) arr.push(i);
    return arr;
  }, [props.totalPages]);

  function goToPage(p: number) {
    const query: Record<string, string> = {};
    if (props.q) query.q = props.q;
    query.page = String(p);
    router.push({ pathname: "/community/board", query });
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    const query: Record<string, string> = {};
    if (q) query.q = q;
    query.page = "1";
    router.push({ pathname: "/community/board", query });
  }

  if (props.loginRequired) {
    return (
      <>
        <Head>
          <title>Calmato | Community</title>
        </Head>
        <div className="min-h-screen bg-black text-white" />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Calmato | Community</title>
      </Head>

      <div className="min-h-screen bg-black text-white">
        <div className="mb-16 px-8 sm:px-12 md:px-16">
          <section className="heroSection">
            <div className="heroImageWrap">
              <Image
                src={REQUEST_BANNER_SRC}
                alt="Track request banner"
                fill
                priority
                className="heroImage"
              />
              <div className="heroOverlay" />
              <div className="heroContent">
                <h1>Community</h1>
                <p>여러분이 간직했던 마음을 나누는 공간입니다</p>
                <p>천천히 이야기를 남겨 주세요</p>
              </div>
            </div>
          </section>

          <section className="tabsSection">
            <CommunityTabs current="board" />
          </section>

          <div className="mt-10 flex items-end justify-between gap-6 pb-3">
            <div>
              <Link
                href="/community/board/write"
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/15"
              >
                게시물 작성하기
              </Link>
            </div>

            <form onSubmit={onSubmitSearch} className="flex items-center gap-3">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  🔍
                </span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="검색어를 입력해 주세요."
                  className="h-10 w-[340px] rounded-xl bg-white/5 pl-10 pr-3 text-sm text-white/85 ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
                />
              </div>
              <button
                type="submit"
                className="h-10 rounded-xl bg-white/10 px-4 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/15"
              >
                검색
              </button>
            </form>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {props.cards.map((c) => (
              <PostCard
                key={c.id}
                href={c.href}
                isLocked={c.isLocked}
                nickname={c.nickname}
                createdAt={c.createdAt}
                title={c.title}
                content={c.content}
                likeCount={c.likeCount}
                commentCount={c.commentCount}
                viewCount={c.viewCount}
                backgroundImageUrl={c.backgroundImageUrl}
              />
            ))}
          </div>

          <div className="mt-10 flex items-center justify-center gap-2 pb-16">
            <button
              onClick={() => goToPage(Math.max(1, props.page - 1))}
              disabled={props.page <= 1}
              className="rounded-lg px-3 py-2 text-sm text-white/70 ring-1 ring-white/10 disabled:opacity-40"
            >
              Prev
            </button>

            <div className="flex items-center gap-1">
              {pages.map((p) => {
                const active = p === props.page;
                return (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={[
                      "h-9 w-9 rounded-lg text-sm ring-1 ring-white/10 transition",
                      active
                        ? "bg-white/15 text-white/90"
                        : "bg-transparent text-white/60 hover:bg-white/10 hover:text-white/80",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => goToPage(Math.min(props.totalPages, props.page + 1))}
              disabled={props.page >= props.totalPages}
              className="rounded-lg px-3 py-2 text-sm text-white/70 ring-1 ring-white/10 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<BoardPageProps> = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  const pageRaw = Array.isArray(ctx.query.page) ? ctx.query.page[0] : ctx.query.page;
  const qRaw = Array.isArray(ctx.query.q) ? ctx.query.q[0] : ctx.query.q;

  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const q = (qRaw ?? "").trim();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      props: {
        loginRequired: true,
        next: ctx.resolvedUrl || "/community/board",
        cards: [],
        page: 1,
        totalPages: 1,
        q,
      },
    };
  }

  const viewerUserId = user.id;

  const countRes = await countBoardPosts(supabase, { q });
  const totalCount = countRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / BOARD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const { data, error } = await getBoardPostsPage(supabase, {
    q,
    page: safePage,
    pageSize: BOARD_PAGE_SIZE,
    profilesFkName: PROFILES_FK_NAME,
  });

  if (error) {
    console.error("[BoardPage] getBoardPostsPage error:", error);

    return {
      props: {
        loginRequired: false,
        cards: [],
        page: safePage,
        totalPages,
        q,
      },
    };
  }

  const posts = (data ?? []) as BoardPostRow[];

  const cards: CardVM[] = posts.map((p) => {
    const isLocked = Boolean(p.is_secret) && p.user_id !== viewerUserId;

    const nickname = p.profiles?.nickname ?? "Unknown";
    const viewCount = p.view_count ?? 0;
    const likeCount = p.like_count ?? 0;
    const commentCount = p.comment_count ?? 0;

    const firstImagePath = p.post_images?.[0]?.storage_path ?? null;
    const backgroundImageUrl = firstImagePath
      ? supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(firstImagePath).data.publicUrl
      : null;

    return {
      id: p.id,
      href: `/community/posts/${p.id}`,
      isLocked,
      nickname,
      createdAt: p.created_at,
      title: isLocked ? "비밀글" : p.title,
      content: isLocked ? "" : clampExcerpt(p.content),
      likeCount,
      commentCount,
      viewCount,
      backgroundImageUrl: isLocked ? null : backgroundImageUrl,
    };
  });

  return {
    props: {
      loginRequired: false,
      cards,
      page: safePage,
      totalPages,
      q,
    },
  };
};