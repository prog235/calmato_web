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

  const profileMap = new Map<string, { nickname: string } | null>();

  if (!profilesRes.error) {
    for (const profile of ((profilesRes.data as ProfileRowRaw[] | null) ?? [])) {
      profileMap.set(profile.id, {
        nickname: profile.nickname ?? "Unknown",
      });
    }
  }

  const merged: BoardPostRow[] = posts.map((post) => ({
    ...post,
    profiles: profileMap.get(post.user_id) ?? null,
    post_images: post.post_images ?? null,
  }));

  return { data: merged, error: null };
}

/* =========================
   상세 페이지용 타입 / 함수
========================= */

export type BoardDetailRow = {
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

type BoardDetailRaw = {
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

export type BoardCommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  profiles: { nickname: string } | null;
};

type BoardCommentRaw = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
};

export type BoardListRow = {
  id: number;
  title: string;
  created_at: string;
};

type BoardListRaw = {
  id: number;
  title: string;
  created_at: string;
  is_secret: boolean;
  user_id: string;
};

export async function getBoardPostById(
  db: SupabaseClient,
  params: { postId: number }
) {
  const postRes = await db
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
    .eq("id", params.postId)
    .order("sort_order", { foreignTable: "post_images", ascending: true })
    .single();

  if (postRes.error || !postRes.data) {
    return { data: null, error: postRes.error };
  }

  const post = postRes.data as BoardDetailRaw;

  const profileRes = await db
    .from("profiles")
    .select("id, nickname")
    .eq("id", post.user_id)
    .maybeSingle();

  const merged: BoardDetailRow = {
    ...post,
    profiles: !profileRes.error && profileRes.data
      ? { nickname: profileRes.data.nickname ?? "Unknown" }
      : null,
    post_images: post.post_images ?? null,
  };

  return { data: merged, error: null };
}

export async function getBoardComments(
  db: SupabaseClient,
  params: { postId: number }
) {
  const commentsRes = await db
    .from("post_comments")
    .select("id, post_id, user_id, parent_comment_id, content, created_at")
    .eq("post_id", params.postId)
    .order("created_at", { ascending: true });

  if (commentsRes.error) {
    return { data: null, error: commentsRes.error };
  }

  const comments = (commentsRes.data as BoardCommentRaw[] | null) ?? [];

  if (comments.length === 0) {
    return { data: [], error: null };
  }

  const userIds = Array.from(new Set(comments.map((comment) => comment.user_id)));

  const profilesRes = await db
    .from("profiles")
    .select("id, nickname")
    .in("id", userIds);

  const profileMap = new Map<string, { nickname: string } | null>();

  if (!profilesRes.error) {
    for (const profile of ((profilesRes.data as ProfileRowRaw[] | null) ?? [])) {
      profileMap.set(profile.id, {
        nickname: profile.nickname ?? "Unknown",
      });
    }
  }

  const merged: BoardCommentRow[] = comments.map((comment) => ({
    ...comment,
    profiles: profileMap.get(comment.user_id) ?? null,
  }));

  return { data: merged, error: null };
}

export async function getBoardSidebarList(
  db: SupabaseClient,
  params: { viewerId?: string | null }
) {
  const postsRes = await db
    .from("posts")
    .select("id, title, created_at, is_secret, user_id")
    .order("created_at", { ascending: false });

  if (postsRes.error) {
    return { data: null, error: postsRes.error };
  }

  const rows = (postsRes.data as BoardListRaw[] | null) ?? [];

  const filtered = rows
    .filter((row) => !row.is_secret || row.user_id === params.viewerId)
    .map<BoardListRow>((row) => ({
      id: row.id,
      title: row.title,
      created_at: row.created_at,
    }));

  return { data: filtered, error: null };
}

export async function getViewerNickname(
  db: SupabaseClient,
  params: { userId: string }
) {
  const res = await db
    .from("profiles")
    .select("nickname")
    .eq("id", params.userId)
    .maybeSingle();

  if (res.error) {
    return { nickname: null, error: res.error };
  }

  return {
    nickname: res.data?.nickname ?? "Unknown",
    error: null,
  };
}
