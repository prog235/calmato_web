// pages/community/board.tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { PencilLine, Search } from "lucide-react";
import { getImage } from "@/lib/getUrl";
import heroStyles from "@/styles/communityHero.module.css";

import PostCard from "@/components/PostCard";
import CommunityTabs from "@/components/CommunityTabs";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import {
  BOARD_PAGE_SIZE,
  countBoardPosts,
  getBoardPostsPage,
  type BoardSort,
  type BoardPostRow,
} from "@/lib/queries/board";

type CardVM = {
  id: number;
  href: string;
  isLocked: boolean;

  nickname: string;
  profileImagePath: string | null;
  createdAt: string;

  title: string;
  content: string;

  likeCount: number;
  commentCount: number;
  viewCount: number;
  initialLiked: boolean;

  backgroundImageUrl?: string | null;
  backgroundColor?: string | null;
};

type BoardPageProps = {
  isLoggedIn: boolean;
  cards: CardVM[];
  page: number;
  totalPages: number;
  q: string;
  sort: BoardSort;
};

const REQUEST_BANNER_SRC = getImage("assets", "banners/community_banner.jpg");
const POST_IMAGES_BUCKET = "post-images";
const EMPTY_USER_ID = "00000000-0000-0000-0000-000000000000";

/**
 * posts.user_id -> profiles.id FK 이름 (Supabase Relationship에서 확인)
 */
const PROFILES_FK_NAME = "posts_user_id_fkey";

function clampExcerpt(content: string) {
  return (content ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeBoardSort(value: string | string[] | undefined): BoardSort {
  const sort = getSingleQueryValue(value);
  if (sort === "likes" || sort === "views" || sort === "mine") return sort;
  return "latest";
}

function buildBoardListQuery(params: {
  page?: number;
  q?: string;
  sort: BoardSort;
}) {
  const query: Record<string, string> = {};
  const q = params.q?.trim() ?? "";

  if (q) query.q = q;
  if (params.sort !== "latest") query.sort = params.sort;
  if (params.page && params.page > 1) query.page = String(params.page);

  return query;
}

export default function BoardPage(props: BoardPageProps) {
  const router = useRouter();
  const [search, setSearch] = useState(props.q ?? "");
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const pages = useMemo(() => {
    const arr: number[] = [];
    for (let i = 1; i <= props.totalPages; i += 1) arr.push(i);
    return arr;
  }, [props.totalPages]);

  function goToPage(p: number) {
    const query = buildBoardListQuery({
      q: props.q,
      sort: props.sort,
      page: p,
    });
    router.push({ pathname: "/community/board", query });
  }

  function onSubmitSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = buildBoardListQuery({ q: search, sort: props.sort });
    router.push({ pathname: "/community/board", query });
  }

  function changeSort(nextSort: BoardSort) {
    if (nextSort === "mine" && !props.isLoggedIn) {
      setLoginModalOpen(true);
      return;
    }

    const query = buildBoardListQuery({ q: search, sort: nextSort });
    router.push({ pathname: "/community/board", query });
  }

  function handleWriteClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (props.isLoggedIn) return;

    e.preventDefault();
    setLoginModalOpen(true);
  }

  return (
    <>
      <Head>
        <title>Calmato | Community</title>
      </Head>

      <div className="min-h-screen">
        <div className="mb-16 px-8 sm:px-12 md:px-16">
          <section className={heroStyles.heroSection}>
            <div className={heroStyles.heroImageWrap}>
              <Image
                src={REQUEST_BANNER_SRC}
                alt="Track request banner"
                fill
                priority
                className={heroStyles.heroImage}
              />
              <div className={heroStyles.heroOverlay} />
              <div className={heroStyles.heroContent}>
                <h1>Community</h1>
                <div className="mx-auto mb-4 h-px w-64 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
                <p>여러분이 간직했던 마음을 나누는 공간입니다</p>
                <p>천천히 이야기를 남겨 주세요</p>
              </div>
            </div>
          </section>

          <section className={heroStyles.tabsSection}>
            <CommunityTabs current="board" />
          </section>

          <div className="mt-5 flex flex-col items-stretch gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
            <div>
              <Link
                href="/community/board/write"
                onClick={handleWriteClick}
                className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-white/5 px-4 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
              >
                <PencilLine size={15} aria-hidden="true" />
                게시물 작성하기
              </Link>
            </div>

            <form
              onSubmit={onSubmitSearch}
              className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            >
              <label className="relative block w-full sm:w-auto">
                <span className="sr-only">자유게시판 정렬 기준</span>
                <select
                  value={props.sort}
                  onChange={(e) => changeSort(e.target.value as BoardSort)}
                  className="h-[38px] w-full appearance-none rounded-xl bg-white/5 px-3 pr-8 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/[0.065] focus:outline-none focus:ring-2 focus:ring-white/20 sm:w-[122px]"
                >
                  <option value="latest">최신 순</option>
                  <option value="likes">좋아요 순</option>
                  <option value="views">조회수 순</option>
                  <option value="mine">내 게시물</option>
                </select>
                <span className="pointer-events-none absolute right-3 top-1/2 h-2 w-2 -translate-y-[65%] rotate-45 border-b border-r border-white/60" />
              </label>

              <div className="relative w-full sm:w-auto">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                  aria-hidden="true"
                />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="듣고 싶은 이야기를 찾아보세요."
                  className="h-[38px] w-full rounded-xl bg-white/5 pl-10 pr-3 text-sm text-white/85 ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20 sm:w-[340px]"
                />
              </div>
            </form>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {props.cards.map((c) => (
              <PostCard
                key={c.id}
                href={c.href}
                postId={c.id}
                isLocked={c.isLocked}
                nickname={c.nickname}
                profileImagePath={c.profileImagePath}
                createdAt={c.createdAt}
                title={c.title}
                content={c.content}
                likeCount={c.likeCount}
                commentCount={c.commentCount}
                viewCount={c.viewCount}
                initialLiked={c.initialLiked}
                backgroundImageUrl={c.backgroundImageUrl}
                backgroundColor={c.backgroundColor}
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

      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        nextPath="/community/board/write"
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<BoardPageProps> = async (ctx) => {
  const supabase = supabaseServerForGSSP(ctx);

  const pageRaw = Array.isArray(ctx.query.page) ? ctx.query.page[0] : ctx.query.page;
  const qRaw = Array.isArray(ctx.query.q) ? ctx.query.q[0] : ctx.query.q;

  const page = Math.max(1, Number(pageRaw ?? "1") || 1);
  const q = (qRaw ?? "").trim();
  const sort = normalizeBoardSort(ctx.query.sort);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const viewerUserId = user?.id ?? null;
  const viewerIdFilter = sort === "mine" ? viewerUserId ?? EMPTY_USER_ID : null;

  const countRes = await countBoardPosts(supabase, { q, viewerId: viewerIdFilter });
  const totalCount = countRes.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / BOARD_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const { data, error } = await getBoardPostsPage(supabase, {
    q,
    page: safePage,
    pageSize: BOARD_PAGE_SIZE,
    profilesFkName: PROFILES_FK_NAME,
    sort,
    viewerId: viewerIdFilter,
  });

  if (error) {
    console.error("[BoardPage] getBoardPostsPage error:", error);

    return {
      props: {
        isLoggedIn: Boolean(user),
        cards: [],
        page: safePage,
        totalPages,
        q,
        sort,
      },
    };
  }

  const posts = (data ?? []) as BoardPostRow[];
  const postIds = posts.map((p) => p.id);

  let likedPostIdSet = new Set<number>();

  if (viewerUserId && postIds.length > 0) {
    const { data: likes, error: likesError } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", viewerUserId)
      .in("post_id", postIds);

    if (likesError) {
      console.error("[BoardPage] post_likes error:", likesError);
    }

    likedPostIdSet = new Set((likes ?? []).map((like) => like.post_id));
  }

  const cards: CardVM[] = posts.map((p) => {
    const isLocked = Boolean(p.is_secret) && p.user_id !== viewerUserId;

    const nickname = p.profiles?.nickname ?? "Unknown";
    const profileImagePath = p.profiles?.profile_image_path ?? null;
    const viewCount = p.view_count ?? 0;
    const likeCount = p.like_count ?? 0;
    const commentCount = p.comment_count ?? 0;

    const firstImagePath = p.post_images?.[0]?.storage_path ?? null;
    let backgroundImageUrl: string | null = null;
    let backgroundColor: string | null = null;

    if (p.card_background_type === "color" && p.card_background_value) {
      backgroundColor = p.card_background_value;
    } else if (p.card_background_type === "asset" && p.card_background_value) {
      backgroundImageUrl = getImage("assets", p.card_background_value);
    } else if (p.card_background_type === "uploaded" && p.card_background_value) {
      backgroundImageUrl = supabase.storage
        .from(POST_IMAGES_BUCKET)
        .getPublicUrl(p.card_background_value).data.publicUrl;
    } else if (firstImagePath) {
      backgroundImageUrl = supabase.storage
        .from(POST_IMAGES_BUCKET)
        .getPublicUrl(firstImagePath).data.publicUrl;
    }

    return {
      id: p.id,
      href: `/community/board/${p.id}`,
      isLocked,
      nickname,
      profileImagePath,
      createdAt: p.created_at,
      title: isLocked ? "비밀글" : p.title,
      content: isLocked ? "" : clampExcerpt(p.content),
      likeCount,
      commentCount,
      viewCount,
      initialLiked: likedPostIdSet.has(p.id),
      backgroundImageUrl: isLocked ? null : backgroundImageUrl,
      backgroundColor: isLocked ? null : backgroundColor,
    };
  });

  return {
    props: {
      isLoggedIn: Boolean(user),
      cards,
      page: safePage,
      totalPages,
      q,
      sort,
    },
  };
};
