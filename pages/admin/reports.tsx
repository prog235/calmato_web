import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  LockKeyhole,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
  Trash2,
  XCircle,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

const POST_IMAGES_BUCKET = "post-images";

type AdminReportsPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

type ReportKind = "post" | "comment";

type ProfileRow = {
  id: string;
  nickname: string | null;
  profile_image_path?: string | null;
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
  created_at: string;
  card_background_type: string | null;
  card_background_value: string | null;
  post_images: PostImageRow[] | null;
};

type CommentRow = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
};

type PostReportRow = {
  id: number;
  post_id: number;
  reporter_id: string;
  reason: string;
  created_at: string;
};

type CommentReportRow = {
  id: number;
  comment_id: number;
  reporter_id: string;
  reason: string;
  created_at: string;
};

type ReportVM = {
  kind: ReportKind;
  id: number;
  reason: string;
  created_at: string;
  reporterId: string;
  reporterNickname: string;
  targetId: number;
  targetReportCount: number;
  targetAuthorId: string | null;
  targetAuthorNickname: string;
  postId: number | null;
  postTitle: string | null;
  content: string;
  parentComment: {
    id: number;
    content: string;
    authorNickname: string;
  } | null;
  missingTarget: boolean;
  post?: PostRow | null;
};

type Message = {
  type: "success" | "error";
  text: string;
};

const REPORT_REASON_LABELS: Record<string, string> = {
  spam: "스팸 또는 광고성 내용",
  harassment: "욕설 또는 괴롭힘",
  hate_or_discrimination: "혐오 또는 차별적 표현",
  sexual_or_inappropriate: "선정적이거나 부적절한 내용",
  privacy_or_personal_info: "개인정보 노출",
  other: "기타",
  reported_from_comment_menu: "댓글 메뉴 신고",
  reported_from_post_detail: "게시글 상세 신고",
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

function getReasonLabel(reason: string) {
  return REPORT_REASON_LABELS[reason] ?? reason;
}

function getPostStoragePaths(post: PostRow | null | undefined) {
  if (!post) return [];

  const paths = new Set<string>();

  for (const image of post.post_images ?? []) {
    if (image.storage_path) paths.add(image.storage_path);
  }

  if (post.card_background_type === "uploaded" && post.card_background_value) {
    paths.add(post.card_background_value);
  }

  return Array.from(paths);
}

export default function AdminReportsPage({ admin }: AdminReportsPageProps) {
  const [reports, setReports] = useState<ReportVM[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | ReportKind>("all");
  const [processingKey, setProcessingKey] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (filter === "all") return reports;
    return reports.filter((report) => report.kind === filter);
  }, [filter, reports]);

  useEffect(() => {
    void loadReports();
  }, []);

  function profileName(profileMap: Map<string, ProfileRow>, userId: string | null) {
    if (!userId) return "Unknown";
    return profileMap.get(userId)?.nickname ?? "Unknown";
  }

  async function loadReports() {
    setLoading(true);
    setErrorMessage(null);

    const [postReportsRes, commentReportsRes] = await Promise.all([
      supabase
        .from("post_reports")
        .select("id, post_id, reporter_id, reason, created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("comment_reports")
        .select("id, comment_id, reporter_id, reason, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (postReportsRes.error || commentReportsRes.error) {
      setReports([]);
      setErrorMessage(
        postReportsRes.error?.message ??
          commentReportsRes.error?.message ??
          "신고 목록을 불러오지 못했습니다."
      );
      setLoading(false);
      return;
    }

    const postReports = (postReportsRes.data ?? []) as PostReportRow[];
    const commentReports = (commentReportsRes.data ?? []) as CommentReportRow[];

    const postIds = Array.from(new Set(postReports.map((report) => report.post_id)));
    const commentIds = Array.from(
      new Set(commentReports.map((report) => report.comment_id))
    );

    const [postsRes, commentsRes] = await Promise.all([
      postIds.length > 0
        ? supabase
            .from("posts")
            .select(
              `
                id,
                user_id,
                title,
                content,
                created_at,
                card_background_type,
                card_background_value,
                post_images(storage_path, sort_order)
              `
            )
            .in("id", postIds)
        : Promise.resolve({ data: [], error: null }),
      commentIds.length > 0
        ? supabase
            .from("post_comments")
            .select("id, post_id, user_id, parent_comment_id, content, created_at")
            .in("id", commentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (postsRes.error || commentsRes.error) {
      setReports([]);
      setErrorMessage(
        postsRes.error?.message ??
          commentsRes.error?.message ??
          "신고 대상을 불러오지 못했습니다."
      );
      setLoading(false);
      return;
    }

    const posts = (postsRes.data ?? []) as unknown as PostRow[];
    const comments = (commentsRes.data ?? []) as CommentRow[];
    const commentPostIds = Array.from(new Set(comments.map((comment) => comment.post_id)));
    const parentCommentIds = Array.from(
      new Set(
        comments
          .map((comment) => comment.parent_comment_id)
          .filter((id): id is number => id !== null)
      )
    );
    const missingCommentPostIds = commentPostIds.filter(
      (postId) => !posts.some((post) => post.id === postId)
    );

    const [commentPostsRes, parentCommentsRes] = await Promise.all([
      missingCommentPostIds.length > 0
        ? supabase
            .from("posts")
            .select(
              `
                id,
                user_id,
                title,
                content,
                created_at,
                card_background_type,
                card_background_value,
                post_images(storage_path, sort_order)
              `
            )
            .in("id", missingCommentPostIds)
        : Promise.resolve({ data: [], error: null }),
      parentCommentIds.length > 0
        ? supabase
            .from("post_comments")
            .select("id, post_id, user_id, parent_comment_id, content, created_at")
            .in("id", parentCommentIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (commentPostsRes.error || parentCommentsRes.error) {
      setReports([]);
      setErrorMessage(
        commentPostsRes.error?.message ??
          parentCommentsRes.error?.message ??
          "신고 맥락을 불러오지 못했습니다."
      );
      setLoading(false);
      return;
    }

    const allPosts = [
      ...posts,
      ...((commentPostsRes.data ?? []) as unknown as PostRow[]),
    ];
    const parentComments = (parentCommentsRes.data ?? []) as CommentRow[];
    const postMap = new Map(allPosts.map((post) => [post.id, post]));
    const commentMap = new Map(comments.map((comment) => [comment.id, comment]));
    const parentCommentMap = new Map(
      parentComments.map((comment) => [comment.id, comment])
    );

    const userIds = Array.from(
      new Set(
        [
          ...postReports.map((report) => report.reporter_id),
          ...commentReports.map((report) => report.reporter_id),
          ...allPosts.map((post) => post.user_id),
          ...comments.map((comment) => comment.user_id),
          ...parentComments.map((comment) => comment.user_id),
        ].filter(Boolean)
      )
    );

    const profilesRes =
      userIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, nickname, profile_image_path")
            .in("id", userIds)
        : { data: [], error: null };

    const profileMap = new Map<string, ProfileRow>();
    if (!profilesRes.error) {
      for (const profile of (profilesRes.data ?? []) as ProfileRow[]) {
        profileMap.set(profile.id, profile);
      }
    }

    const postReportCountMap = new Map<number, number>();
    for (const report of postReports) {
      postReportCountMap.set(
        report.post_id,
        (postReportCountMap.get(report.post_id) ?? 0) + 1
      );
    }

    const commentReportCountMap = new Map<number, number>();
    for (const report of commentReports) {
      commentReportCountMap.set(
        report.comment_id,
        (commentReportCountMap.get(report.comment_id) ?? 0) + 1
      );
    }

    const postReportVMs: ReportVM[] = postReports.map((report) => {
      const post = postMap.get(report.post_id) ?? null;

      return {
        kind: "post",
        id: report.id,
        reason: report.reason,
        created_at: report.created_at,
        reporterId: report.reporter_id,
        reporterNickname: profileName(profileMap, report.reporter_id),
        targetId: report.post_id,
        targetReportCount: postReportCountMap.get(report.post_id) ?? 1,
        targetAuthorId: post?.user_id ?? null,
        targetAuthorNickname: profileName(profileMap, post?.user_id ?? null),
        postId: report.post_id,
        postTitle: post?.title ?? null,
        content: post ? stripHtml(post.content) : "삭제되었거나 접근할 수 없는 게시글입니다.",
        parentComment: null,
        missingTarget: !post,
        post,
      };
    });

    const commentReportVMs: ReportVM[] = commentReports.map((report) => {
      const comment = commentMap.get(report.comment_id) ?? null;
      const post = comment ? postMap.get(comment.post_id) ?? null : null;
      const parentComment =
        comment?.parent_comment_id !== null && comment?.parent_comment_id !== undefined
          ? parentCommentMap.get(comment.parent_comment_id) ?? null
          : null;

      return {
        kind: "comment",
        id: report.id,
        reason: report.reason,
        created_at: report.created_at,
        reporterId: report.reporter_id,
        reporterNickname: profileName(profileMap, report.reporter_id),
        targetId: report.comment_id,
        targetReportCount: commentReportCountMap.get(report.comment_id) ?? 1,
        targetAuthorId: comment?.user_id ?? null,
        targetAuthorNickname: profileName(profileMap, comment?.user_id ?? null),
        postId: comment?.post_id ?? null,
        postTitle: post?.title ?? null,
        content: comment?.content ?? "삭제되었거나 접근할 수 없는 댓글입니다.",
        parentComment: parentComment
          ? {
              id: parentComment.id,
              content: parentComment.content,
              authorNickname: profileName(profileMap, parentComment.user_id),
            }
          : null,
        missingTarget: !comment,
      };
    });

    setReports(
      [...postReportVMs, ...commentReportVMs].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
    );
    setLoading(false);
  }

  async function dismissReport(report: ReportVM) {
    const confirmed = window.confirm("이 신고를 기각할까요?");
    if (!confirmed) return;

    const key = `${report.kind}:${report.id}:dismiss`;
    setProcessingKey(key);
    setMessage(null);

    const table = report.kind === "post" ? "post_reports" : "comment_reports";
    const { error } = await supabase.from(table).delete().eq("id", report.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
      setProcessingKey(null);
      return;
    }

    setReports((prev) =>
      prev.filter((item) => !(item.kind === report.kind && item.id === report.id))
    );
    setMessage({ type: "success", text: "신고를 기각했습니다." });
    setProcessingKey(null);
  }

  async function deleteReportedTarget(report: ReportVM) {
    const targetLabel = report.kind === "post" ? "게시글" : "댓글";
    const confirmed = window.confirm(`신고된 ${targetLabel}을 삭제할까요?`);
    if (!confirmed) return;

    const key = `${report.kind}:${report.id}:delete`;
    setProcessingKey(key);
    setMessage(null);

    try {
      if (report.kind === "post") {
        const storagePaths = getPostStoragePaths(report.post);
        const postRes = await supabase.from("posts").delete().eq("id", report.targetId);
        if (postRes.error) throw postRes.error;

        await supabase.from("post_reports").delete().eq("post_id", report.targetId);

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
            setMessage({ type: "success", text: "게시글을 삭제했습니다." });
          }
        } else {
          setMessage({ type: "success", text: "게시글을 삭제했습니다." });
        }

        setReports((prev) =>
          prev.filter(
            (item) => !(item.kind === "post" && item.targetId === report.targetId)
          )
        );
      } else {
        const commentRes = await supabase
          .from("post_comments")
          .delete()
          .eq("id", report.targetId);
        if (commentRes.error) throw commentRes.error;

        await supabase.from("comment_reports").delete().eq("comment_id", report.targetId);

        setReports((prev) =>
          prev.filter(
            (item) => !(item.kind === "comment" && item.targetId === report.targetId)
          )
        );
        setMessage({ type: "success", text: "댓글을 삭제했습니다." });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : `${targetLabel} 삭제 중 오류가 발생했습니다.`,
      });
    } finally {
      setProcessingKey(null);
    }
  }

  async function clearMissingReport(report: ReportVM) {
    const table = report.kind === "post" ? "post_reports" : "comment_reports";
    const key = `${report.kind}:${report.id}:dismiss`;
    setProcessingKey(key);
    const { error } = await supabase.from(table).delete().eq("id", report.id);

    if (error) {
      setMessage({ type: "error", text: error.message });
    } else {
      setReports((prev) =>
        prev.filter((item) => !(item.kind === report.kind && item.id === report.id))
      );
      setMessage({ type: "success", text: "대상이 없는 신고를 정리했습니다." });
    }

    setProcessingKey(null);
  }

  return (
    <>
      <Head>
        <title>Report Admin | Calmato</title>
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
                Report Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 신고된 게시글과
                댓글을 확인하고 처리할 수 있습니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/posts"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Post Admin
              </Link>
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Admin Home
              </Link>
            </div>
          </header>

          <section className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">신고 목록</h2>
                <p className="mt-1 text-sm text-white/45">
                  총 {reports.length}건 중 {filteredReports.length}건 표시
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {(["all", "post", "comment"] as const).map((nextFilter) => (
                  <button
                    key={nextFilter}
                    type="button"
                    onClick={() => setFilter(nextFilter)}
                    className={`inline-flex h-9 items-center justify-center rounded-md border px-3 text-sm font-medium transition ${
                      filter === nextFilter
                        ? "border-white/35 bg-white/12 text-white"
                        : "border-white/12 text-white/60 hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
                    }`}
                  >
                    {nextFilter === "all"
                      ? "전체"
                      : nextFilter === "post"
                        ? "게시글"
                        : "댓글"}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => loadReports()}
                  disabled={loading}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/12 px-3 text-sm font-medium text-white/60 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {loading ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  새로고침
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
                  <XCircle size={17} strokeWidth={1.8} />
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
                  신고 목록을 불러오고 있습니다.
                </div>
              ) : filteredReports.length === 0 ? (
                <div className="flex min-h-64 items-center justify-center text-sm text-white/45">
                  표시할 신고가 없습니다.
                </div>
              ) : (
                <div className="divide-y divide-white/8">
                  {filteredReports.map((report) => {
                    const dismissKey = `${report.kind}:${report.id}:dismiss`;
                    const deleteKey = `${report.kind}:${report.id}:delete`;

                    return (
                      <article
                        key={`${report.kind}-${report.id}`}
                        className="grid gap-4 bg-black/14 p-4 transition hover:bg-white/[0.035] lg:grid-cols-[1fr_auto]"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-white/38">
                            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-white/62">
                              {report.kind === "post" ? (
                                <ShieldAlert size={13} />
                              ) : (
                                <MessageSquareWarning size={13} />
                              )}
                              {report.kind === "post" ? "게시글" : "댓글"}
                            </span>
                            <span>신고 #{report.id}</span>
                            <span className="rounded-full border border-red-300/20 bg-red-400/10 px-2 py-0.5 text-red-100/85">
                              누적 {report.targetReportCount}건
                            </span>
                            <span>{formatDateTime(report.created_at)}</span>
                            {report.missingTarget && (
                              <span className="rounded-full border border-amber-300/20 px-2 py-0.5 text-amber-100/80">
                                대상 없음
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 truncate text-base font-medium text-white/88">
                            {report.kind === "post"
                              ? (report.postTitle ?? `게시글 #${report.targetId}`)
                              : `댓글 #${report.targetId}`}
                          </h3>

                          {report.postTitle && report.kind === "comment" && (
                            <p className="mt-1 text-xs text-white/38">
                              게시글: {report.postTitle}
                            </p>
                          )}

                          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/58">
                            {report.content || "내용 없음"}
                          </p>

                          {report.parentComment && (
                            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.025] p-3">
                              <div className="text-xs font-medium text-white/42">
                                Parent comment · {report.parentComment.authorNickname}
                              </div>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/52">
                                {report.parentComment.content}
                              </p>
                            </div>
                          )}

                          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/38">
                            <span>사유: {getReasonLabel(report.reason)}</span>
                            <span>신고자: {report.reporterNickname}</span>
                            <span>대상 작성자: {report.targetAuthorNickname}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                          {report.postId && (
                            <Link
                              href={`/community/board/${report.postId}`}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/12 px-3 text-sm font-medium text-white/65 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
                            >
                              <ExternalLink size={15} />
                              보기
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              report.missingTarget
                                ? clearMissingReport(report)
                                : dismissReport(report)
                            }
                            disabled={processingKey === dismissKey}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/12 px-3 text-sm font-medium text-white/65 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {processingKey === dismissKey ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={15} />
                            )}
                            기각
                          </button>
                          {!report.missingTarget && (
                            <button
                              type="button"
                              onClick={() => deleteReportedTarget(report)}
                              disabled={processingKey === deleteKey}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-300/20 px-3 text-sm font-medium text-red-100 transition hover:border-red-300/35 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {processingKey === deleteKey ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Trash2 size={15} />
                              )}
                              대상 삭제
                            </button>
                          )}
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

export const getServerSideProps: GetServerSideProps<
  AdminReportsPageProps
> = async (ctx) => {
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
