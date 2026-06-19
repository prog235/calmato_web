import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Heart,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Search,
  Trash2,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

const POST_IMAGES_BUCKET = "post-images";

type AdminPostsPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

type PostImageRow = {
  storage_path: string | null;
  sort_order: number | null;
};

type PostRow = {
  id: number;
  user_id: string;
  title: string;
  content: string;
  is_secret: boolean;
  created_at: string;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  card_background_type: string | null;
  card_background_value: string | null;
  profiles: {
    nickname: string | null;
    profile_image_path: string | null;
  } | null;
  post_images: PostImageRow[] | null;
};

type RawPostRow = Omit<PostRow, "profiles">;

type ProfileRow = {
  id: string;
  nickname: string | null;
  profile_image_path: string | null;
};

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateTime(iso: string) {
  const date = new Date(iso);
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function AdminPostsPage({ admin }: AdminPostsPageProps) {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filteredPosts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;

    return posts.filter((post) => {
      return [
        post.title,
        stripHtml(post.content),
        post.profiles?.nickname ?? "",
        String(post.id),
      ].some((value) => value.toLowerCase().includes(q));
    });
  }, [posts, query]);

  useEffect(() => {
    void loadPosts();
  }, []);

  async function loadPosts() {
    setLoading(true);
    setErrorMessage(null);

    const { data, error } = await supabase
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
          card_background_type,
          card_background_value,
          post_images(storage_path, sort_order)
        `
      )
      .order("created_at", { ascending: false })
      .order("sort_order", { foreignTable: "post_images", ascending: true });

    if (error) {
      setPosts([]);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rawPosts = (data ?? []) as unknown as RawPostRow[];
    const userIds = Array.from(new Set(rawPosts.map((post) => post.user_id)));
    const profileMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname, profile_image_path")
        .in("id", userIds);

      if (!profilesError) {
        for (const profile of (profilesData ?? []) as ProfileRow[]) {
          profileMap.set(profile.id, profile);
        }
      }
    }

    const rows: PostRow[] = rawPosts.map((post) => ({
      ...post,
      profiles: profileMap.get(post.user_id) ?? null,
    }));

    setPosts(rows);
    setLoading(false);
  }

  function getStoragePaths(post: PostRow) {
    const paths = new Set<string>();

    for (const image of post.post_images ?? []) {
      if (image.storage_path) paths.add(image.storage_path);
    }

    if (
      post.card_background_type === "uploaded" &&
      post.card_background_value
    ) {
      paths.add(post.card_background_value);
    }

    return Array.from(paths);
  }

  async function deletePost(post: PostRow) {
    const confirmed = window.confirm(
      `"${post.title}" 게시글을 삭제할까요? 댓글, 좋아요, 첨부 이미지 정보는 DB cascade로 함께 삭제됩니다.`
    );

    if (!confirmed) return;

    setDeletingId(post.id);
    setMessage(null);

    const storagePaths = getStoragePaths(post);

    try {
      const postRes = await supabase.from("posts").delete().eq("id", post.id);
      if (postRes.error) throw postRes.error;

      if (storagePaths.length > 0) {
        const storageRes = await supabase.storage
          .from(POST_IMAGES_BUCKET)
          .remove(storagePaths);

        if (storageRes.error) {
          setMessage({
            type: "error",
            text: `게시글은 삭제됐지만 이미지 파일 삭제 실패: ${storageRes.error.message}`,
          });
        } else {
          setMessage({
            type: "success",
            text: "게시글이 삭제되었습니다.",
          });
        }
      } else {
        setMessage({
          type: "success",
          text: "게시글이 삭제되었습니다.",
        });
      }

      setPosts((prev) => prev.filter((item) => item.id !== post.id));
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "게시글 삭제 중 오류가 발생했습니다.",
      });
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Head>
        <title>Post Admin | Calmato</title>
      </Head>

      <main className="min-h-screen bg-[#0a0a0a] px-5 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
                <LockKeyhole size={14} strokeWidth={1.8} />
                Admin only
              </div>
              <h1 className="text-3xl font-medium tracking-normal text-white md:text-5xl">
                Post Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 게시글 목록을
                확인하고 삭제할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Admin Home
              </Link>
              <Link
                href="/admin/reports"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Report Admin
              </Link>
            </div>
          </header>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">전체 게시글</h2>
                <p className="mt-1 text-sm text-white/45">
                  총 {posts.length}개 게시글 중 {filteredPosts.length}개 표시
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="relative block">
                  <Search
                    size={15}
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/38"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="h-10 w-full rounded-md border border-white/10 bg-black/24 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30 sm:w-72"
                    placeholder="제목, 내용, 작성자, ID 검색"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => loadPosts()}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/65 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? "불러오는 중" : "새로고침"}
                </button>
              </div>
            </div>

            {message && (
              <div
                className={`mt-5 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                    : "border-red-400/20 bg-red-400/10 text-red-100"
                }`}
              >
                {message.type === "success" ? (
                  <CheckCircle2 size={17} strokeWidth={1.8} />
                ) : (
                  <Trash2 size={17} strokeWidth={1.8} />
                )}
                <span>{message.text}</span>
              </div>
            )}

            {errorMessage && (
              <div className="mt-5 rounded-md border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                {errorMessage}
              </div>
            )}

            <div className="mt-6 overflow-hidden rounded-md border border-white/10">
              {loading ? (
                <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-white/45">
                  <Loader2 size={17} className="animate-spin" />
                  게시글을 불러오고 있습니다.
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-white/45">
                  표시할 게시글이 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {filteredPosts.map((post) => {
                    const excerpt = stripHtml(post.content);
                    const imageCount = getStoragePaths(post).length;

                    return (
                      <article
                        key={post.id}
                        className="grid gap-4 bg-black/14 p-4 transition hover:bg-white/[0.035] lg:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-white/38">
                            <span>#{post.id}</span>
                            <span>{formatDateTime(post.created_at)}</span>
                            {post.is_secret && (
                              <span className="rounded-full border border-white/10 px-2 py-0.5 text-white/55">
                                비밀글
                              </span>
                            )}
                            {imageCount > 0 && <span>이미지 {imageCount}개</span>}
                          </div>

                          <h3 className="mt-2 truncate text-base font-medium text-white/88">
                            {post.title}
                          </h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">
                            {excerpt || "내용 없음"}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/38">
                            <span>
                              작성자: {post.profiles?.nickname ?? "Unknown"}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Eye size={14} /> {post.view_count ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Heart size={14} /> {post.like_count ?? 0}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessageCircle size={14} /> {post.comment_count ?? 0}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 lg:justify-end">
                          <Link
                            href={`/community/board/${post.id}`}
                            className="inline-flex h-9 items-center justify-center rounded-md border border-white/12 px-3 text-sm font-medium text-white/65 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
                          >
                            보기
                          </Link>
                          <button
                            type="button"
                            onClick={() => deletePost(post)}
                            disabled={deletingId === post.id}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-300/20 px-3 text-sm font-medium text-red-100 transition hover:border-red-300/35 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {deletingId === post.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} strokeWidth={1.8} />
                            )}
                            삭제
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminPostsPageProps> = async (
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
