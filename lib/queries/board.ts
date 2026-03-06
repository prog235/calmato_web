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
export async function countBoardPosts(db: SupabaseClient, params: { q?: string }) {
  const or = buildBoardSearchOr(params.q ?? "");

  let query = db.from("posts").select("id", { count: "exact", head: true });

  if (or) query = query.or(or);

  const res = await query;
  return { count: res.count ?? 0, error: res.error };
}

/**
 * 한 페이지 게시글 조회 (profiles nickname + post_images 첫 장 + likes/comments count용 id 배열)
 *
 * profilesFkName:
 *   posts.user_id -> profiles.id 관계 FK 이름
 *   예: "posts_user_id_fkey"
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

  // FK 이름을 이용해 profiles 조인
  // 예: profiles:profiles!posts_user_id_fkey(nickname)
  const profilesJoin = `profiles:profiles!${params.profilesFkName}(nickname)`;

  let query = db
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
        ${profilesJoin},
        post_images(storage_path, sort_order)
      `
    )
    .order("created_at", { ascending: false })
    .range(from, to)
    // post_images: sort_order 기준으로 첫 장만
    .order("sort_order", { foreignTable: "post_images", ascending: true })
    .limit(1, { foreignTable: "post_images" });

  if (or) query = query.or(or);

  const res = await query;
  return { data: (res.data as BoardPostRow[] | null) ?? null, error: res.error };
}
