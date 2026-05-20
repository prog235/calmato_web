// pages/community/board/[id].tsx
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { type ChangeEvent, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { CornerDownRight, Heart, MessageCircle } from "lucide-react";

import LoginRequiredModal from "@/components/LoginRequiredModal";
import { supabase } from "@/lib/supabaseClient";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import {
  getBoardComments,
  getBoardPostById,
  getBoardSidebarList,
  getViewerNickname,
  type BoardCommentRow,
  type BoardDetailRow,
  type BoardListRow,
} from "@/lib/queries/board";
import styles from "@/styles/boardDetailPage.module.css";

const POST_IMAGE_BUCKET = "post-images";

type Viewer = {
  id: string;
  nickname: string;
} | null;

type CommentVM = {
  id: number;
  post_id: number;
  user_id: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  nickname: string;
};

type ImageVM = {
  storage_path: string;
  sort_order: number | null;
  url: string;
};

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

  const postRes = await getBoardPostById(db, { postId });

  if (postRes.error || !postRes.data) {
    return { notFound: true };
  }

  const postRow: BoardDetailRow = postRes.data;

  if (postRow.is_secret && user?.id !== postRow.user_id) {
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
    const viewerNickRes = await getViewerNickname(db, { userId: user.id });
    viewer = {
      id: user.id,
      nickname: viewerNickRes.nickname ?? "Unknown",
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

  const [replyOpenId, setReplyOpenId] = useState<number | null>(null);
  const [replyExpandedMap, setReplyExpandedMap] = useState<Record<number, boolean>>({});
  const [replyTextMap, setReplyTextMap] = useState<Record<number, string>>({});

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

  return (
    <>
      <Head>
        <title>Post | Community</title>
      </Head>

      <main className={styles.page}>
        <div className={`${styles.container} px-8 sm:px-12 md:px-16`}>
          <article className={styles.article}>
            <header className={`${styles.header} border-b border-white/20`}>
              <h1 className={styles.title}>{post.title}</h1>

              <div className={styles.metaRow}>
                <div className={styles.metaLeft}>
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
              <div className={styles.body}>{renderMultilineText(post.content)}</div>
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
          </section>

          <section className={styles.commentSection}>
            <div className={styles.commentComposer}>
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={viewer ? "댓글을 입력해주세요." : "로그인 후 댓글을 작성할 수 있습니다."}
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => handleCreateComment(null)}
                disabled={submitting}
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

                  return (
                    <div key={comment.id} className={styles.commentBlock}>
                      <div className={styles.commentCard}>
                        <div className={styles.commentMeta}>
                          <span className={styles.commentNickname}>{comment.nickname}</span>
                          <span className={styles.dot}>·</span>
                          <span>{formatDate(comment.created_at)}</span>
                        </div>

                        <div className={styles.commentContent}>
                          {renderMultilineText(comment.content)}
                        </div>

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

                      {((replies.length > 0 && repliesExpanded) ||
                        replyOpenId === comment.id) && (
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
                                      <div className={styles.commentMeta}>
                                        <span className={styles.commentNickname}>{reply.nickname}</span>
                                        <span className={styles.dot}>·</span>
                                        <span>{formatDate(reply.created_at)}</span>
                                      </div>

                                      <div className={styles.commentContent}>
                                        {renderMultilineText(reply.content)}
                                      </div>

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
                            <div className={styles.replyComposer}>
                              <textarea
                                value={replyTextMap[comment.id] ?? ""}
                                onChange={(e) => handleReplyTextChange(comment.id, e)}
                                onFocus={(e) => resizeTextarea(e.currentTarget)}
                                placeholder="답글을 입력해주세요."
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
                                  disabled={submitting}
                                >
                                  답글 등록
                                </button>
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

                return (
                  <Link
                    key={item.id}
                    href={`/community/board/${item.id}`}
                    className={`${styles.allPostRow} ${
                      isCurrent ? styles.currentPostRow : ""
                    }`}
                  >
                    <span className={styles.allPostTitle}>{item.title}</span>
                    <span className={styles.allPostDate}>
                      {formatDate(item.created_at)}
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
    </>
  );
}
