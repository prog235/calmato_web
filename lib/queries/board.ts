// src/lib/queries/board.ts
import type { SupabaseClient } from "@supabase/supabase-js";

export const BOARD_PAGE_SIZE = 9;

export type BoardPostRow = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  is_secret: boolean;
  created_at: string;

  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;

  profiles: { nickname: string } | null;

  post_images: { storage_path: string | null; sort_order: number | null }[] | null;
};

export function buildBoardSearchOr(q: string) {
  const trimmed = (q ?? "").trim();
  if (!trimmed) return null;

  // title OR content
  return `title.ilike.%${trimmed}%,content.ilike.%${trimmed}%`;
}

/**
 * 게시글 개수(페이지네이션용)
 */
export async function countBoardPosts(
  db: SupabaseClient,
  params: { q?: string }
) {
  const or = buildBoardSearchOr(params.q ?? "");

  let query = db.from("posts").select("id", { count: "exact", head: true });

  if (or) query = query.or(or);

  const res = await query;
  return { count: res.count ?? 0, error: res.error };
}

type PostRowRaw = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  is_secret: boolean;
  created_at: string;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  post_images: { storage_path: string | null; sort_order: number | null }[] | null;
};

type ProfileRowRaw = {
  id: string;
  nickname: string | null;
};

/**
 * 한 페이지 게시글 조회
 *
 * 주의:
 * 기존에는 posts.user_id -> profiles.id FK를 이용해
 * profiles:profiles!fk_name(nickname) 형태로 직접 조인했지만,
 * 이제 posts.user_id -> auth.users.id 이므로 같은 방식의 embed join은 불가능합니다.
 *
 * 외부 호출부와 충돌을 피하기 위해 params.profilesFkName은 그대로 받되,
 * 내부에서는 사용하지 않습니다.
 */
export async function getBoardPostsPage(
  db: SupabaseClient,
  params: {
    q?: string;
    page: number;
    pageSize?: number;
    profilesFkName: string;
  }
) {
  const pageSize = params.pageSize ?? BOARD_PAGE_SIZE;
  const page = Math.max(1, params.page);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const or = buildBoardSearchOr(params.q ?? "");

  let postsQuery = db
    .from("posts")
    .select(
      `
        id,
        user_id,
        title,
        content,
        is_secret,
        created_at,
        view_count,
        like_count,
        comment_count,
        post_images(storage_path, sort_order)
      `
    )
    .order("created_at", { ascending: false })
    .range(from, to)
    .order("sort_order", { foreignTable: "post_images", ascending: true })
    .limit(1, { foreignTable: "post_images" });

  if (or) postsQuery = postsQuery.or(or);

  const postsRes = await postsQuery;

  if (postsRes.error) {
    return { data: null, error: postsRes.error };
  }

  const posts = (postsRes.data as PostRowRaw[] | null) ?? [];

  if (posts.length === 0) {
    return { data: [], error: null };
  }

  const userIds = Array.from(new Set(posts.map((post) => post.user_id)));

  const profilesRes = await db
    .from("profiles")
    .select("id, nickname")
    .in("id", userIds);

  if (profilesRes.error) {
    return { data: null, error: profilesRes.error };
  }

  const profileMap = new Map<string, { nickname: string } | null>();

  for (const profile of ((profilesRes.data as ProfileRowRaw[] | null) ?? [])) {
    profileMap.set(profile.id, {
      nickname: profile.nickname ?? "Unknown",
    });
  }

  const merged: BoardPostRow[] = posts.map((post) => ({
    ...post,
    profiles: profileMap.get(post.user_id) ?? null,
    post_images: post.post_images ?? null,
  }));

  return { data: merged, error: null };
}