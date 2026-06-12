// pages/community/board/[id].tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import {
  CornerDownRight,
  Flag,
  Heart,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import LoginRequiredModal from "@/components/LoginRequiredModal";
import ProfileAvatar from "@/components/ProfileAvatar";
import { supabase } from "@/lib/supabaseClient";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import {
  getBoardComments,
  getBoardPostById,
  getBoardSidebarList,
  type BoardCommentRow,
  type BoardDetailRow,
  type BoardListRow,
} from "@/lib/queries/board";
import styles from "@/styles/boardDetailPage.module.css";

const POST_IMAGE_BUCKET = "post-images";

type Viewer = {
  id: string;
  nickname: string;
  profileImagePath: string | null;
} | null;

type CommentVM = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  nickname: string;
  profileImagePath: string | null;
};

type ReportTarget =
  | { type: "post"; postId: number }
  | { type: "comment"; comment: CommentVM };

type ReportPopoverPosition = {
  top: number;
  left: number;
  placement: "above" | "below";
};

type ImageVM = {
  storage_path: string;
  sort_order: number | null;
  url: string;
};

const REPORT_REASONS = [
  { value: "spam", label: "스팸 또는 광고성 내용" },
  { value: "harassment", label: "욕설 또는 괴롭힘" },
  { value: "hate_or_discrimination", label: "혐오 또는 차별적 표현" },
  { value: "sexual_or_inappropriate", label: "선정적이거나 부적절한 내용" },
  { value: "privacy_or_personal_info", label: "개인정보 노출" },
  { value: "other", label: "기타" },
] as const;

type ReportReason = (typeof REPORT_REASONS)[number]["value"];

type PageProps = {
  post: {
    id: number;
    user_id: string;
    title: string;
    content: string;
    is_secret: boolean;
    created_at: string;
    view_count: number;
    like_count: number;
    comment_count: number;
    author_nickname: string;
    authorProfileImagePath: string | null;
    initialLiked: boolean;
  };
  images: ImageVM[];
  initialComments: CommentVM[];
  allPosts: BoardListRow[];
  viewer: Viewer;
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${yyyy}.${mm}.${dd}. ${hh}:${mi}`;
}

function renderMultilineText(text: string) {
  return text.split("\n").map((line, idx) => (
    <span key={idx}>
      {line}
      <br />
    </span>
  ));
}

function isHtmlContent(text: string) {
  return /<\/?[a-z][\s\S]*>/i.test(text);
}

function getReportErrorMessage(error: unknown, targetLabel: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return `이미 신고한 ${targetLabel}입니다.`;
  }

  return `${targetLabel} 신고 처리 중 오류가 발생했습니다.`;
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const db = supabaseServerForGSSP(ctx);

  const rawId = ctx.params?.id;
  const postId = Number(rawId);

  if (!Number.isFinite(postId)) {
    return { notFound: true };
  }

  const {
    data: { user },
  } = await db.auth.getUser();

  let viewerProfile: {
    nickname: string | null;
    profile_image_path: string | null;
    role: string | null;
  } | null = null;

  if (user?.id) {
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("nickname, profile_image_path, role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("[BoardDetailPage] viewer profile error:", profileError);
    }

    viewerProfile = profile ?? null;
  }

  const postRes = await getBoardPostById(db, { postId });

  if (postRes.error || !postRes.data) {
    return { notFound: true };
  }

  const postRow: BoardDetailRow = postRes.data;
  const isAdmin = viewerProfile?.role === "admin";

  if (postRow.is_secret && user?.id !== postRow.user_id && !isAdmin) {
    return { notFound: true };
  }

  const commentsRes = await getBoardComments(db, { postId });
  if (commentsRes.error || !commentsRes.data) {
    return { notFound: true };
  }

  const allPostsRes = await getBoardSidebarList(db, {
    viewerId: user?.id ?? null,
  });
  if (allPostsRes.error || !allPostsRes.data) {
    return { notFound: true };
  }

  let viewer: Viewer = null;
  let initialLiked = false;

  if (user?.id) {
    viewer = {
      id: user.id,
      nickname: viewerProfile?.nickname ?? "Unknown",
      profileImagePath: viewerProfile?.profile_image_path ?? null,
    };

    const likedRes = await db
      .from("post_likes")
      .select("post_id")
      .eq("post_id", postRow.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (likedRes.error) {
      console.error("[BoardDetailPage] post_likes error:", likedRes.error);
    }

    initialLiked = Boolean(likedRes.data);
  }

  const images: ImageVM[] =
    (postRow.post_images ?? [])
      .filter(
        (
          img
        ): img is {
          storage_path: string;
          sort_order: number | null;
        } => Boolean(img.storage_path)
      )
      .map((img) => {
        const {
          data: { publicUrl },
        } = db.storage.from(POST_IMAGE_BUCKET).getPublicUrl(img.storage_path);

        return {
          storage_path: img.storage_path,
          sort_order: img.sort_order,
          url: publicUrl,
        };
      });

  const initialComments: CommentVM[] = (commentsRes.data as BoardCommentRow[]).map(
    (comment) => ({
      id: comment.id,
      post_id: comment.post_id,
      user_id: comment.user_id,
      parent_comment_id: comment.parent_comment_id,
      content: comment.content,
      created_at: comment.created_at,
      nickname: comment.profiles?.nickname ?? "Unknown",
      profileImagePath: comment.profiles?.profile_image_path ?? null,
    })
  );

  return {
    props: {
      post: {
        id: postRow.id,
        user_id: postRow.user_id,
        title: postRow.title,
        content: postRow.content,
        is_secret: postRow.is_secret,
        created_at: postRow.created_at,
        view_count: postRow.view_count ?? 0,
        like_count: postRow.like_count ?? 0,
        comment_count: postRow.comment_count ?? 0,
        author_nickname: postRow.profiles?.nickname ?? "Unknown",
        authorProfileImagePath: postRow.profiles?.profile_image_path ?? null,
        initialLiked,
      },
      images,
      initialComments,
      allPosts: allPostsRes.data,
      viewer,
    },
  };
};

export default function BoardDetailPage({
  post,
  images,
  initialComments,
  allPosts,
  viewer,
}: PageProps) {
  const router = useRouter();
  const isOwnSecretPost = post.is_secret && viewer?.id === post.user_id;

  useEffect(() => {
    if (!post?.id) return;

    const key = `viewed_post_${post.id}`;

    if (sessionStorage.getItem(key)) return;

    sessionStorage.setItem(key, "true");

    supabase
      .rpc("increment_post_view", {
        p_post_id: post.id,
      })
      .then(({ error }) => {
        if (error) {
          console.error("[increment_post_view]", error);
          sessionStorage.removeItem(key);
          return;
        }

        setViewCount((prev) => prev + 1);
      });
  }, [post?.id]);

  const [comments, setComments] = useState<CommentVM[]>(initialComments);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [viewCount, setViewCount] = useState(post.view_count);
  const [isLiked, setIsLiked] = useState(post.initialLiked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [postActionLoading, setPostActionLoading] = useState(false);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [selectedReportReason, setSelectedReportReason] =
    useState<ReportReason>("spam");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportPopoverPosition, setReportPopoverPosition] =
    useState<ReportPopoverPosition | null>(null);

  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyExpandedMap, setReplyExpandedMap] = useState<Record<number, boolean>>({});
  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});
  const [openCommentMenuId, setOpenCommentMenuId] = useState<number | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [commentActionLoadingId, setCommentActionLoadingId] = useState<number | null>(null);

  const [commentLikeState, setCommentLikeState] = useState<
    Record<number, { liked: boolean; count: number }>
  >(() => {
    const init: Record<number, { liked: boolean; count: number }> = {};
    for (const c of initialComments) {
      init[c.id] = { liked: false, count: 0 };
    }
    return init;
  });

  const parentComments = useMemo(
    () => comments.filter((c) => c.parent_comment_id === null),
    [comments]
  );

  const childMap = useMemo(() => {
    const map = new Map<number, CommentVM[]>();
    for (const c of comments) {
      if (c.parent_comment_id === null) continue;
      const arr = map.get(c.parent_comment_id) ?? [];
      arr.push(c);
      map.set(c.parent_comment_id, arr);
    }
    return map;
  }, [comments]);

  useEffect(() => {
    if (!reportTarget) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-report-popover]")) return;

      closeReportDialog();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeReportDialog();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [reportSubmitting, reportTarget]);

  async function handleCreateComment(parentCommentId: number | null = null) {
    const content =
      parentCommentId === null
        ? newComment.trim()
        : (replyTextMap[parentCommentId] ?? "").trim();

    if (!viewer) {
      setLoginModalOpen(true);
      return;
    }

    if (!content) {
      alert(parentCommentId === null ? "댓글 내용을 입력해주세요." : "답글 내용을 입력해주세요.");
      return;
    }

    try {
      setSubmitting(true);

      const { data, error } = await supabase
        .from("post_comments")
        .insert({
          post_id: post.id,
          user_id: viewer.id,
          parent_comment_id: parentCommentId,
          content,
        })
        .select("id, post_id, user_id, parent_comment_id, content, created_at")
        .single();

      if (error || !data) {
        throw error;
      }

      const inserted: CommentVM = {
        ...data,
        nickname: viewer.nickname,
        profileImagePath: viewer.profileImagePath,
      };

      setComments((prev) => [...prev, inserted]);
      setCommentCount((prev) => prev + 1);

      if (parentCommentId === null) {
        setNewComment("");
      } else {
        setReplyTextMap((prev) => ({ ...prev, [parentCommentId]: "" }));
        setReplyExpandedMap((prev) => ({ ...prev, [parentCommentId]: true }));
        setReplyOpenId(null);
      }
    } catch (error) {
      console.error(error);
      alert("댓글 등록 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePostLike() {
    if (isLikeLoading) return;

    setIsLikeLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLikeLoading(false);
      setLoginModalOpen(true);
      return;
    }

    const prevLiked = isLiked;
    const prevCount = likeCount;

    setIsLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);

    if (prevLiked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", post.id)
        .eq("user_id", user.id);

      if (error) {
        setIsLiked(prevLiked);
        setLikeCount(prevCount);
        console.error(error);
      }
    } else {
      const { error } = await supabase.from("post_likes").insert({
        post_id: post.id,
        user_id: user.id,
      });

      if (error) {
        setIsLiked(prevLiked);
        setLikeCount(prevCount);
        console.error(error);
      }
    }

    setIsLikeLoading(false);
  }

  function toggleCommentLike(commentId: number) {
    setCommentLikeState((prev) => {
      const current = prev[commentId] ?? { liked: false, count: 0 };
      const nextLiked = !current.liked;

      return {
        ...prev,
        [commentId]: {
          liked: nextLiked,
          count: current.count + (nextLiked ? 1 : -1),
        },
      };
    });
  }

  function resizeTextarea(textarea: HTMLTextAreaElement) {
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }

  function handleReplyTextChange(
    commentId: number,
    e: ChangeEvent<HTMLTextAreaElement>
  ) {
    const value = e.target.value;
    resizeTextarea(e.target);
    setReplyTextMap((prev) => ({
      ...prev,
      [commentId]: value,
    }));
  }

  function toggleReplyComposer(commentId: number) {
    if (!viewer) {
      setLoginModalOpen(true);
      return;
    }

    setReplyOpenId((prev) => {
      const nextOpen = prev === commentId ? null : commentId;

      if (nextOpen === commentId) {
        setReplyExpandedMap((current) => ({
          ...current,
          [commentId]: true,
        }));
      }

      return nextOpen;
    });
  }

  function isOwnComment(comment: CommentVM) {
    return viewer?.id === comment.user_id;
  }

  function startEditComment(comment: CommentVM) {
    if (!isOwnComment(comment)) return;

    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
    setOpenCommentMenuId(null);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentText("");
  }

  async function saveEditComment(comment: CommentVM) {
    const nextContent = editingCommentText.trim();

    if (!nextContent) {
      alert("댓글 내용을 입력해주세요.");
      return;
    }

    setCommentActionLoadingId(comment.id);

    try {
      const { error } = await supabase
        .from("post_comments")
        .update({ content: nextContent })
        .eq("id", comment.id)
        .eq("user_id", viewer?.id ?? "");

      if (error) throw error;

      setComments((prev) =>
        prev.map((item) =>
          item.id === comment.id ? { ...item, content: nextContent } : item
        )
      );
      cancelEditComment();
    } catch (error) {
      console.error(error);
      alert("댓글 수정 중 오류가 발생했습니다.");
    } finally {
      setCommentActionLoadingId(null);
    }
  }

  async function deleteComment(comment: CommentVM) {
    if (!isOwnComment(comment)) return;

    const confirmed = window.confirm("댓글을 삭제할까요?");
    if (!confirmed) return;

    setCommentActionLoadingId(comment.id);
    setOpenCommentMenuId(null);

    try {
      const { error } = await supabase
        .from("post_comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", viewer?.id ?? "");

      if (error) throw error;

      setComments((prev) => {
        const removedIds = new Set<number>([comment.id]);
        for (const item of prev) {
          if (item.parent_comment_id === comment.id) removedIds.add(item.id);
        }

        setCommentCount((count) => Math.max(0, count - removedIds.size));
        return prev.filter((item) => !removedIds.has(item.id));
      });

      if (editingCommentId === comment.id) cancelEditComment();
    } catch (error) {
      console.error(error);
      alert("댓글 삭제 중 오류가 발생했습니다.");
    } finally {
      setCommentActionLoadingId(null);
    }
  }

  function openReportDialog(target: ReportTarget, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const popoverWidth = Math.min(320, window.innerWidth - 24);
    const estimatedPopoverHeight = 340;
    const placement = rect.top > estimatedPopoverHeight + 16 ? "above" : "below";

    setSelectedReportReason("spam");
    setReportTarget(target);
    setReportPopoverPosition({
      top:
        placement === "above"
          ? Math.max(estimatedPopoverHeight + 12, rect.top - 10)
          : Math.max(
              12,
              Math.min(rect.bottom + 10, window.innerHeight - estimatedPopoverHeight - 12)
            ),
      left: Math.min(
        Math.max(rect.right, popoverWidth + 12),
        window.innerWidth - 12
      ),
      placement,
    });
  }

  function closeReportDialog() {
    if (reportSubmitting) return;

    setReportTarget(null);
    setReportPopoverPosition(null);
    setSelectedReportReason("spam");
  }

  function reportComment(comment: CommentVM, anchor: HTMLElement) {
    setOpenCommentMenuId(null);

    if (!viewer) {
      setLoginModalOpen(true);
      return;
    }

    openReportDialog({ type: "comment", comment }, anchor);
  }

  async function submitReport() {
    if (!viewer) {
      setLoginModalOpen(true);
      return;
    }

    if (!reportTarget || reportSubmitting) return;

    setReportSubmitting(true);

    const targetLabel = reportTarget.type === "post" ? "게시글" : "댓글";

    if (reportTarget.type === "comment") {
      setCommentActionLoadingId(reportTarget.comment.id);
    } else {
      setPostActionLoading(true);
    }

    try {
      const { error } =
        reportTarget.type === "comment"
          ? await supabase.from("comment_reports").insert({
              comment_id: reportTarget.comment.id,
              reporter_id: viewer.id,
              reason: selectedReportReason,
            })
          : await supabase.from("post_reports").insert({
              post_id: reportTarget.postId,
              reporter_id: viewer.id,
              reason: selectedReportReason,
            });

      if (error) throw error;

      alert(`${targetLabel} 신고가 접수되었습니다.`);
      setReportTarget(null);
      setReportPopoverPosition(null);
      setSelectedReportReason("spam");
    } catch (error) {
      console.error(error);
      alert(getReportErrorMessage(error, targetLabel));
    } finally {
      setReportSubmitting(false);
      setCommentActionLoadingId(null);
      setPostActionLoading(false);
    }
  }

  function isOwnPost() {
    return viewer?.id === post.user_id;
  }

  function startEditPost() {
    if (!isOwnPost()) return;

    void router.push(`/community/board/write?edit=${post.id}`);
  }

  async function deletePost() {
    if (!isOwnPost()) return;

    const confirmed = window.confirm("게시글을 삭제할까요?");
    if (!confirmed) return;

    setPostActionLoading(true);

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id)
        .eq("user_id", viewer?.id ?? "");

      if (error) throw error;

      const storagePaths = images.map((image) => image.storage_path);
      if (storagePaths.length > 0) {
        await supabase.storage.from(POST_IMAGE_BUCKET).remove(storagePaths);
      }

      await router.push("/community/board");
    } catch (error) {
      console.error(error);
      alert("게시글 삭제 중 오류가 발생했습니다.");
      setPostActionLoading(false);
    }
  }

  function reportPost(anchor: HTMLElement) {
    if (!viewer) {
      setLoginModalOpen(true);
      return;
    }

    openReportDialog({ type: "post", postId: post.id }, anchor);
  }

  function renderCommentMenu(comment: CommentVM) {
    const own = isOwnComment(comment);

    return (
      <div className={styles.commentMenuWrap}>
        <button
          type="button"
          className={styles.commentMenuButton}
          onClick={() =>
            setOpenCommentMenuId((current) =>
              current === comment.id ? null : comment.id
            )
          }
          aria-label="댓글 메뉴"
        >
          <MoreHorizontal size={17} strokeWidth={1.8} />
        </button>

        {openCommentMenuId === comment.id && (
          <div className={styles.commentDropdown}>
            {own ? (
              <>
                <button
                  type="button"
                  onClick={() => startEditComment(comment)}
                  disabled={commentActionLoadingId === comment.id}
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  <span>수정</span>
                </button>
                <button
                  type="button"
                  onClick={() => deleteComment(comment)}
                  disabled={commentActionLoadingId === comment.id}
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  <span>삭제</span>
                </button>
              </>
            ) : (
	              <button
	                type="button"
	                onClick={(event) => reportComment(comment, event.currentTarget)}
	                disabled={commentActionLoadingId === comment.id}
	              >
                <Flag size={14} strokeWidth={1.8} />
                <span>신고</span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Post | Community</title>
      </Head>

      <main className={styles.page}>
        <div className={`${styles.container} px-8 sm:px-12 md:px-16`}>
          <article className={styles.article}>
            <header className={`${styles.header} border-b border-white/20`}>
              <div className={styles.titleRow}>
                <h1 className={styles.title}>{post.title}</h1>
                {isOwnSecretPost && (
                  <span className={styles.secretBadge}>
                    <LockKeyhole size={14} strokeWidth={1.8} aria-hidden="true" />
                    내 비밀글
                  </span>
                )}
              </div>

              <div className={styles.metaRow}>
                <div className={styles.metaLeft}>
                  <ProfileAvatar
                    imagePath={post.authorProfileImagePath}
                    className="h-6 w-6 shrink-0 ring-1 ring-white/10"
                    sizes="32px"
                  />
                  <span className={styles.author}>{post.author_nickname}</span>
                  <span className={styles.dot}>·</span>
                  <span>{formatDate(post.created_at)}</span>
                </div>

                <div className={styles.metaRight}>
                  <span>좋아요 {likeCount}</span>
                  <span className={styles.dot}>·</span>
                  <span>댓글 {commentCount}</span>
                  <span className={styles.dot}>·</span>
                  <span>조회수 {viewCount}</span>
                </div>
              </div>
            </header>

            {isHtmlContent(post.content) ? (
              <div
                className={styles.body}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            ) : (
              <div className={styles.body}>
                {renderMultilineText(post.content)}
              </div>
            )}
          </article>

          {images.length > 0 && (
            <section className={styles.filmSection} aria-label="게시글 이미지">
              <div className={`${styles.filmFade} ${styles.filmFadeLeft}`} />
              <div className={`${styles.filmFade} ${styles.filmFadeRight}`} />

              <div className={`${styles.filmScroll} hide-scrollbar`}>
                <div className={styles.filmImageTrack}>
                  {images.map((img, idx) => (
                    <div
                      className={styles.filmImageItem}
                      key={`${img.storage_path}-${idx}`}
                    >
                      <Image
                        src={img.url}
                        alt={`post image ${idx + 1}`}
                        width={1600}
                        height={900}
                        className={styles.filmPhotoImage}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          <section className={styles.countSection}>
            <div className={styles.countActionRow}>
              <div className={styles.countInner}>
                <button
                  type="button"
                  onClick={handlePostLike}
                  disabled={isLikeLoading}
                  className={styles.postLikeButton}
                >
                  <Heart
                    size={18}
                    className={isLiked ? styles.postLikeIconActive : styles.postLikeIcon}
                  />
                  <span>좋아요 {likeCount}</span>
                </button>
                <span className={styles.dot}>·</span>
                <span className={styles.countMetric}>
                  <MessageCircle size={18} />
                  <span>댓글 {commentCount}</span>
                </span>
              </div>

              <div className={styles.postActionButtons}>
                {isOwnPost() ? (
                  <>
                    <button
                      type="button"
                      onClick={startEditPost}
                      disabled={postActionLoading}
                    >
                      <Pencil size={14} strokeWidth={1.8} />
                      <span>수정</span>
                    </button>
                    <button
                      type="button"
                      onClick={deletePost}
                      disabled={postActionLoading}
                    >
                      <Trash2 size={14} strokeWidth={1.8} />
                      <span>삭제</span>
                    </button>
                  </>
                ) : (
	                  <button
	                    type="button"
	                    onClick={(event) => reportPost(event.currentTarget)}
	                    disabled={postActionLoading}
	                  >
                    <Flag size={14} strokeWidth={1.8} />
                    <span>신고</span>
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className={styles.commentSection}>
            <div
              className={[
                styles.commentComposer,
                newComment.trim() ? styles.commentComposerActive : "",
              ].join(" ")}
            >
              <ProfileAvatar
                imagePath={viewer?.profileImagePath}
                className="h-10 w-10 shrink-0 ring-1 ring-white/10"
                sizes="40px"
              />
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={viewer ? "댓글을 입력해주세요." : "로그인 후 댓글을 작성할 수 있습니다."}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => handleCreateComment(null)}
                disabled={submitting || !newComment.trim()}
              >
                등록
              </button>
            </div>

            <div>
              {parentComments.length === 0 ? (
                <div className={styles.emptyComments}>첫 댓글을 남겨보세요.</div>
              ) : (
                parentComments.map((comment) => {
                  const replies = childMap.get(comment.id) ?? [];
                  const repliesExpanded = Boolean(replyExpandedMap[comment.id]);
                  const likeInfo = commentLikeState[comment.id] ?? {
                    liked: false,
                    count: 0,
                  };
                  const replyThreadOpen =
                    (replies.length > 0 && repliesExpanded) ||
                    replyOpenId === comment.id;

                  return (
                    <div
                      key={comment.id}
                      className={[
                        styles.commentBlock,
                        replyThreadOpen ? styles.commentBlockWithReplyThread : "",
                      ].join(" ")}
                    >
                      <div className={styles.commentCard}>
                        <div className={styles.commentMetaRow}>
                          <div className={styles.commentMeta}>
                            <ProfileAvatar
                              imagePath={comment.profileImagePath}
                              className="h-6 w-6 shrink-0 ring-1 ring-white/10"
                              sizes="24px"
                            />
                            <span className={styles.commentNickname}>{comment.nickname}</span>
                            <span className={styles.dot}>·</span>
                            <span>{formatDate(comment.created_at)}</span>
                          </div>
                          {renderCommentMenu(comment)}
                        </div>

                        {editingCommentId === comment.id ? (
                          <div className={styles.editCommentComposer}>
                            <textarea
                              value={editingCommentText}
                              onChange={(e) => setEditingCommentText(e.target.value)}
                              disabled={commentActionLoadingId === comment.id}
                            />
                            <div className={styles.editCommentActions}>
                              <button
                                type="button"
                                onClick={cancelEditComment}
                                disabled={commentActionLoadingId === comment.id}
                              >
                                취소
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEditComment(comment)}
                                disabled={
                                  commentActionLoadingId === comment.id ||
                                  !editingCommentText.trim()
                                }
                              >
                                저장
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.commentContent}>
                            {renderMultilineText(comment.content)}
                          </div>
                        )}

                        <div className={styles.commentActions}>
                          <button
                            type="button"
                            className={likeInfo.liked ? styles.activeAction : ""}
                            onClick={() => toggleCommentLike(comment.id)}
                          >
                            <Heart
                              size={14}
                              className={
                                likeInfo.liked
                                  ? styles.commentLikeIconActive
                                  : styles.commentLikeIcon
                              }
                            />
                            <span>좋아요 {likeInfo.count > 0 ? likeInfo.count : ""}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => toggleReplyComposer(comment.id)}
                          >
                            답글
                          </button>

                          {replies.length > 0 && (
                            <button
                              type="button"
                              className={styles.replyToggleButton}
                              onClick={() =>
                                setReplyExpandedMap((prev) => ({
                                  ...prev,
                                  [comment.id]: !repliesExpanded,
                                }))
                              }
                            >
                              {repliesExpanded
                                ? "답글 접기"
                                : `답글 ${replies.length}개 보기`}
                            </button>
                          )}
                        </div>

                      </div>

                      {replyThreadOpen && (
                        <div className={styles.replyThread}>
                          {replies.length > 0 && repliesExpanded && (
                            <div className={styles.replyList}>
                              {replies.map((reply) => {
                                const replyLikeInfo = commentLikeState[reply.id] ?? {
                                  liked: false,
                                  count: 0,
                                };

                                return (
                                  <div key={reply.id} className={styles.replyItem}>
                                    <CornerDownRight
                                      size={18}
                                      className={styles.replyArrow}
                                      aria-hidden="true"
                                    />

                                    <div className={styles.replyCard}>
                                      <div className={styles.commentMetaRow}>
                                        <div className={styles.commentMeta}>
                                          <ProfileAvatar
                                            imagePath={reply.profileImagePath}
                                            className="h-7 w-7 shrink-0 ring-1 ring-white/10"
                                            sizes="28px"
                                          />
                                          <span className={styles.commentNickname}>{reply.nickname}</span>
                                          <span className={styles.dot}>·</span>
                                          <span>{formatDate(reply.created_at)}</span>
                                        </div>
                                        {renderCommentMenu(reply)}
                                      </div>

                                      {editingCommentId === reply.id ? (
                                        <div className={styles.editCommentComposer}>
                                          <textarea
                                            value={editingCommentText}
                                            onChange={(e) =>
                                              setEditingCommentText(e.target.value)
                                            }
                                            disabled={commentActionLoadingId === reply.id}
                                          />
                                          <div className={styles.editCommentActions}>
                                            <button
                                              type="button"
                                              onClick={cancelEditComment}
                                              disabled={commentActionLoadingId === reply.id}
                                            >
                                              취소
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => saveEditComment(reply)}
                                              disabled={
                                                commentActionLoadingId === reply.id ||
                                                !editingCommentText.trim()
                                              }
                                            >
                                              저장
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className={styles.commentContent}>
                                          {renderMultilineText(reply.content)}
                                        </div>
                                      )}

                                      <div className={styles.commentActions}>
                                        <button
                                          type="button"
                                          className={
                                            replyLikeInfo.liked ? styles.activeAction : ""
                                          }
                                          onClick={() => toggleCommentLike(reply.id)}
                                        >
                                          <Heart
                                            size={14}
                                            className={
                                              replyLikeInfo.liked
                                                ? styles.commentLikeIconActive
                                                : styles.commentLikeIcon
                                            }
                                          />
                                          <span>
                                            좋아요 {replyLikeInfo.count > 0 ? replyLikeInfo.count : ""}
                                          </span>
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {replyOpenId === comment.id && (
                            <div
                              className={[
                                styles.replyComposer,
                                (replyTextMap[comment.id] ?? "").trim()
                                ? styles.replyComposerActive
                                : "",
                            ].join(" ")}
                          >
                              <CornerDownRight
                                size={18}
                                className={`${styles.replyArrow} ${styles.replyComposerArrow}`}
                                aria-hidden="true"
                              />

                              <div className={styles.replyComposerBody}>
                                <ProfileAvatar
                                  imagePath={viewer?.profileImagePath}
                                  className={`${styles.replyComposerAvatar} h-8 w-8 shrink-0 ring-1 ring-white/10`}
                                  sizes="32px"
                                />

                                <div className={styles.replyComposerField}>
                                  <textarea
                                    value={replyTextMap[comment.id] ?? ""}
                                    onChange={(e) => handleReplyTextChange(comment.id, e)}
                                    onFocus={(e) => resizeTextarea(e.currentTarget)}
                                    placeholder="답글을 입력해주세요."
                                    wrap="off"
                                    disabled={submitting}
                                  />

                                  <div className={styles.replyComposerButtons}>
                                    <button
                                      type="button"
                                      className={styles.ghostButton}
                                      onClick={() => setReplyOpenId(null)}
                                      disabled={submitting}
                                    >
                                      취소
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleCreateComment(comment.id)}
                                      disabled={
                                        submitting ||
                                        !(replyTextMap[comment.id] ?? "").trim()
                                      }
                                    >
                                      답글 등록
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className={styles.allPostsSection}>
            <div className={styles.allPostsTitleRow}>
              <h2>전체 게시글</h2>
              <Link href="/community/board" className={styles.backToList}>
                목록으로
              </Link>
            </div>

            <div className={styles.allPostsList}>
              {allPosts.map((item) => {
                const isCurrent = item.id === post.id;
                const isOwnSecretItem = item.is_secret && item.user_id === viewer?.id;

                return (
                  <Link
                    key={item.id}
                    href={`/community/board/${item.id}`}
                    className={`${styles.allPostRow} ${
                      isCurrent ? styles.currentPostRow : ""
                    }`}
	                  >
	                    <span className={styles.allPostInfo}>
	                      <span className={styles.allPostTitleWrap}>
	                        <span className={styles.allPostTitle}>{item.title}</span>
	                        {isOwnSecretItem && (
	                          <span className={styles.allPostSecretBadge}>
	                            <LockKeyhole size={12} strokeWidth={1.8} aria-hidden="true" />
	                            내 비밀글
	                          </span>
	                        )}
	                      </span>
	                      <span className={styles.allPostMeta}>
	                        <span className={styles.allPostAuthor}>{item.author_nickname}</span>
	                        <span className={styles.allPostDate}>{formatDate(item.created_at)}</span>
	                      </span>
	                    </span>
	                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>

	      <LoginRequiredModal
	        open={loginModalOpen}
	        onClose={() => setLoginModalOpen(false)}
	        nextPath={router.asPath}
	      />

	      {reportTarget && reportPopoverPosition && (
	        <section
	          className={styles.reportPopover}
	          style={{
	            top: reportPopoverPosition.top,
	            left: reportPopoverPosition.left,
	            transform:
	              reportPopoverPosition.placement === "above"
	                ? "translate(-100%, -100%)"
	                : "translate(-100%, 0)",
	          }}
	          role="dialog"
	          aria-modal="false"
	          aria-labelledby="report-popover-title"
	          data-report-popover
	        >
	          <div className={styles.reportPopoverHeader}>
	            <h2 id="report-popover-title">
	              {reportTarget.type === "post" ? "게시글 신고" : "댓글 신고"}
	            </h2>
	            <button
	              type="button"
	              onClick={closeReportDialog}
	              disabled={reportSubmitting}
	              aria-label="신고 창 닫기"
	            >
	              ×
	            </button>
	          </div>

	          <div className={styles.reportReasonList}>
	            {REPORT_REASONS.map((reason) => (
	              <label key={reason.value} className={styles.reportReasonItem}>
	                <input
	                  type="checkbox"
	                  value={reason.value}
	                  checked={selectedReportReason === reason.value}
	                  onChange={() => setSelectedReportReason(reason.value)}
	                  disabled={reportSubmitting}
	                />
	                <span>{reason.label}</span>
	              </label>
	            ))}
	          </div>

	          <div className={styles.reportPopoverActions}>
	            <button
	              type="button"
	              onClick={closeReportDialog}
	              disabled={reportSubmitting}
	            >
	              취소
	            </button>
	            <button
	              type="button"
	              onClick={submitReport}
	              disabled={reportSubmitting}
	            >
	              {reportSubmitting ? "접수 중..." : "신고하기"}
	            </button>
	          </div>
	        </section>
	      )}
	    </>
	  );
	}
