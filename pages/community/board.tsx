import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

// =============================================
// Calmato Board & Request Page
// - No explicit colors; relies on CSS variables used in the project
// - Works for both "board" (free board) and "request" (request board)
// - LocalStorage-backed demo data; replace with API later
// - Essential features: tabs, list, search/filter/sort, pagination,
//   create/edit/delete, view modal, likes, views, comments, pin, tags
// =============================================

// ---------- Types ----------
type BoardKind = "board" | "request";

type Comment = {
  id: string;
  author: string; // simple text; replace with user id later
  body: string;
  createdAt: string; // ISO
};

type Post = {
  id: string;
  kind: BoardKind;
  title: string;
  content: string;
  author: string;
  tags: string[];
  pinned?: boolean;
  likes: number;
  views: number;
  createdAt: string; // ISO
  updatedAt?: string; // ISO
  comments: Comment[];
};

// ---------- Utilities ----------
function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

const LS_KEY = "calmato_board_v1";

function loadPosts(): Post[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Post[];
  } catch (e) {}
  // Seed with a couple of demo posts (pinned + normal)
  const seed: Post[] = [
    {
      id: uid("post"),
      kind: "board",
      title: "환영합니다! 자유게시판 이용 안내",
      content:
        "커뮤니티 가이드라인: 1) 서로 존중하기 2) 스팸 금지 3) 작품/음원 공유 시 출처 표기\n요청 탭은 요청 전용으로 사용해주세요.",
      author: "Admin",
      tags: ["notice", "guide"],
      pinned: true,
      likes: 7,
      views: 203,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      comments: [
        {
          id: uid("cmt"),
          author: "Suna",
          body: "좋은 커뮤니티가 되길!",
          createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6).toISOString(),
        },
      ],
    },
    {
      id: uid("post"),
      kind: "request",
      title: "ASMR 플레이리스트 썸네일 템플릿 요청",
      content:
        "라이트/다크 테마 모두 어울리는 썸네일 템플릿이 필요해요. 폰트/여백/그리드 제안 부탁!",
      author: "K",
      tags: ["design", "asmr"],
      likes: 3,
      views: 88,
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
      comments: [],
    },
  ];
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_KEY, JSON.stringify(seed));
  }
  return seed;
}

function savePosts(posts: Post[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LS_KEY, JSON.stringify(posts));
}

// ---------- Tag helpers ----------
const allTagOptions = ["notice", "guide", "design", "asmr", "dev", "music", "tip"];

// ---------- Main Component ----------
export default function BoardAndRequestPage() {
  // current tab from hash ("#board" or "#request"); default: board
  const [tab, setTab] = useState<BoardKind>(() => {
    if (typeof window !== "undefined") {
      const h = window.location.hash.replace("#", "");
      if (h === "board" || h === "request") return h;
    }
    return "board";
  });

  const [posts, setPosts] = useState<Post[]>(loadPosts);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "popular" | "commented">("recent");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Compose filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = posts.filter((p) => p.kind === tab);
    if (selectedTag !== "all") list = list.filter((p) => p.tags.includes(selectedTag));
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Separate pinned
    const pinned = list.filter((p) => p.pinned);
    const normals = list.filter((p) => !p.pinned);

    // Sort normals
    normals.sort((a, b) => {
      if (sort === "recent") return +new Date(b.createdAt) - +new Date(a.createdAt);
      if (sort === "popular") return b.likes - a.likes || b.views - a.views;
      // commented
      return (b.comments?.length || 0) - (a.comments?.length || 0);
    });

    return { pinned, normals };
  }, [posts, query, selectedTag, tab, sort]);

  const total = filtered.pinned.length + filtered.normals.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pagedNormals = useMemo(() => {
    const start = (page - 1) * pageSize - filtered.pinned.length;
    if (start <= 0) return filtered.normals.slice(0, Math.max(0, pageSize - filtered.pinned.length));
    return filtered.normals.slice(start, start + pageSize);
  }, [filtered, page]);

  // hash sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash.replace("#", "") !== tab) {
        window.history.replaceState(null, "", `#${tab}`);
      }
      const onHash = () => {
        const h = window.location.hash.replace("#", "");
        if (h === "board" || h === "request") setTab(h);
      };
      window.addEventListener("hashchange", onHash);
      return () => window.removeEventListener("hashchange", onHash);
    }
  }, [tab]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [tab, query, selectedTag, sort]);

  // ---------- Post create/edit modal ----------
  const [editing, setEditing] = useState<Post | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  function openCreate(kind: BoardKind) {
    setEditing({
      id: uid("post"),
      kind,
      title: "",
      content: "",
      author: "You", // replace with session user
      tags: [],
      likes: 0,
      views: 0,
      createdAt: new Date().toISOString(),
      comments: [],
    });
    setEditorOpen(true);
  }

  function openEdit(p: Post) {
    setEditing({ ...p });
    setEditorOpen(true);
  }

  function saveEditing() {
    if (!editing) return;
    setPosts((prev) => {
      const exists = prev.some((p) => p.id === editing.id);
      const next = exists ? prev.map((p) => (p.id === editing.id ? { ...editing, updatedAt: new Date().toISOString() } : p)) : [editing, ...prev];
      savePosts(next);
      return next;
    });
    setEditorOpen(false);
  }

  function deletePost(id: string) {
    setPosts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePosts(next);
      return next;
    });
  }

  function togglePin(id: string) {
    setPosts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p));
      savePosts(next);
      return next;
    });
  }

  function likePost(id: string) {
    setPosts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, likes: p.likes + 1 } : p));
      savePosts(next);
      return next;
    });
  }

  function addView(id: string) {
    setPosts((prev) => {
      const next = prev.map((p) => (p.id === id ? { ...p, views: p.views + 1 } : p));
      savePosts(next);
      return next;
    });
  }

  function addComment(postId: string, body: string) {
    setPosts((prev) => {
      const next = prev.map((p) =>
        p.id === postId
          ? {
              ...p,
              comments: [
                ...p.comments,
                { id: uid("cmt"), author: "You", body, createdAt: new Date().toISOString() },
              ],
            }
          : p
      );
      savePosts(next);
      return next;
    });
  }

  // ---------- View modal ----------
  const [activePost, setActivePost] = useState<Post | null>(null);
  function openView(p: Post) {
    setActivePost(p);
    addView(p.id);
  }

  // ---------- Render ----------
  return (
    <main className="min-h-screen pb-24">
      {/* Top bar */}
      <div className="sticky top-0 z-40 backdrop-blur border-b border-[var(--border)]/60 bg-[var(--background)]/70">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm opacity-70">Community</span>
            <span className="opacity-40">/</span>
            <strong className="text-base">Board</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={`px-4 h-9 rounded-xl transition card-shadow ${
                tab === "board"
                  ? "bg-[var(--hover-background)] font-semibold"
                  : "bg-[var(--foreground)]/50 hover:opacity-100 opacity-90"
              }`}
              onClick={() => setTab("board")}
            >
              자유게시판
            </button>
            <button
              className={`px-4 h-9 rounded-xl transition card-shadow ${
                tab === "request"
                  ? "bg-[var(--hover-background)] font-semibold"
                  : "bg-[var(--foreground)]/50 hover:opacity-100 opacity-90"
              }`}
              onClick={() => setTab("request")}
            >
              요청게시판
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <section className="mx-auto max-w-6xl px-6 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tab === "board" ? "제목/내용/태그 검색" : "요청 검색"}
              className="h-10 px-3 rounded-xl bg-[var(--foreground)]/50 focus:outline-none focus:ring-2 focus:ring-[var(--ring)]/70"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="h-10 px-3 rounded-xl bg-[var(--foreground)]/50 focus:outline-none"
              title="Sort"
            >
              <option value="recent">최신순</option>
              <option value="popular">인기순</option>
              <option value="commented">댓글순</option>
            </select>
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="h-10 px-3 rounded-xl bg-[var(--foreground)]/50 focus:outline-none"
              title="Tag filter"
            >
              <option value="all">전체 태그</option>
              {allTagOptions.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => openCreate(tab)}
              className="h-10 px-4 rounded-xl bg-[var(--hover-background)] font-medium card-shadow"
            >
              새 글 쓰기
            </button>
          </div>
        </div>
      </section>

      {/* List */}
      <section className="mx-auto max-w-6xl px-6 mt-6">
        {/* Pinned */}
        {filtered.pinned.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm opacity-70 mb-2">고정 글</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filtered.pinned.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  onView={() => openView(p)}
                  onLike={() => likePost(p.id)}
                  onEdit={() => openEdit(p)}
                  onDelete={() => deletePost(p.id)}
                  onTogglePin={() => togglePin(p.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Normals (paged) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pagedNormals.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onView={() => openView(p)}
              onLike={() => likePost(p.id)}
              onEdit={() => openEdit(p)}
              onDelete={() => deletePost(p.id)}
              onTogglePin={() => togglePin(p.id)}
            />
          ))}
        </div>

        {/* Empty state */}
        {total === 0 && (
          <div className="text-center py-20 opacity-70">아직 글이 없습니다. 첫 글을 작성해보세요.</div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              className="h-9 px-3 rounded-lg bg-[var(--foreground)]/50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              이전
            </button>
            <div className="text-sm opacity-70">
              {page} / {totalPages}
            </div>
            <button
              className="h-9 px-3 rounded-lg bg-[var(--foreground)]/50 disabled:opacity-50"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              다음
            </button>
          </div>
        )}
      </section>

      {/* Editor Modal */}
      <AnimatePresence>
        {isEditorOpen && editing && (
          <Modal onClose={() => setEditorOpen(false)}>
            <div className="flex items-center justify-between mb-4">
              <strong>{editing.title ? "글 수정" : "새 글 쓰기"}</strong>
              <span className="opacity-50 text-sm">{editing.kind === "board" ? "자유게시판" : "요청게시판"}</span>
            </div>
            <div className="flex flex-col gap-3">
              <input
                className="h-11 px-3 rounded-xl bg-[var(--foreground)]/50 focus:outline-none"
                placeholder="제목"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <textarea
                className="min-h-[180px] p-3 rounded-xl bg-[var(--foreground)]/50 focus:outline-none"
                placeholder="내용"
                value={editing.content}
                onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              />
              <TagPicker
                selected={editing.tags}
                onChange={(tags) => setEditing({ ...editing, tags })}
              />
              <div className="flex items-center justify-between mt-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!editing.pinned}
                      onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                    />
                    고정
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-10 px-4 rounded-xl bg-[var(--foreground)]/50"
                    onClick={() => setEditorOpen(false)}
                  >
                    취소
                  </button>
                  <button
                    className="h-10 px-4 rounded-xl bg-[var(--hover-background)] font-medium"
                    onClick={saveEditing}
                    disabled={!editing.title.trim()}
                  >
                    저장
                  </button>
                </div>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* View Modal */}
      <AnimatePresence>
        {activePost && (
          <Modal onClose={() => setActivePost(null)}>
            <article>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold mb-1">{activePost.title}</h2>
                  <div className="text-sm opacity-60 flex items-center gap-2">
                    <span>{activePost.author}</span>
                    <span>·</span>
                    <time>{new Date(activePost.createdAt).toLocaleString()}</time>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="h-9 px-3 rounded-lg bg-[var(--foreground)]/50"
                    onClick={() => likePost(activePost.id)}
                  >
                    좋아요 ({posts.find((p) => p.id === activePost.id)?.likes ?? activePost.likes})
                  </button>
                  <button
                    className="h-9 px-3 rounded-lg bg-[var(--foreground)]/50"
                    onClick={() => togglePin(activePost.id)}
                  >
                    {activePost.pinned ? "고정 해제" : "고정"}
                  </button>
                  <button
                    className="h-9 px-3 rounded-lg bg-[var(--foreground)]/50"
                    onClick={() => {
                      deletePost(activePost.id);
                      setActivePost(null);
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {activePost.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[var(--foreground)]/50">#{t}</span>
                ))}
              </div>
              <div className="mt-6 whitespace-pre-wrap leading-relaxed">
                {activePost.content}
              </div>
              <div className="mt-6 text-sm opacity-60 flex items-center gap-3">
                <span>조회수 {posts.find((p) => p.id === activePost.id)?.views ?? activePost.views}</span>
                <span>·</span>
                <span>댓글 {posts.find((p) => p.id === activePost.id)?.comments.length ?? activePost.comments.length}</span>
              </div>

              {/* Comments */}
              <hr className="my-6 border-[var(--border)]/60" />
              <h3 className="font-medium mb-3">댓글</h3>
              <CommentList
                comments={posts.find((p) => p.id === activePost.id)?.comments ?? activePost.comments}
              />
              <CommentForm
                onSubmit={(text) => {
                  if (!text.trim()) return;
                  addComment(activePost.id, text.trim());
                }}
              />
            </article>
          </Modal>
        )}
      </AnimatePresence>
    </main>
  );
}

// ---------- Subcomponents ----------
function PostCard({
  post,
  onView,
  onLike,
  onEdit,
  onDelete,
  onTogglePin,
}: {
  post: Post;
  onView: () => void;
  onLike: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0.8, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`group relative rounded-2xl overflow-hidden card-shadow bg-[var(--foreground)]/60 hover:bg-[var(--hover-background)] transition`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {post.pinned && <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--foreground)]/50">고정</span>}
              <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--foreground)]/50">{post.kind === "board" ? "자유" : "요청"}</span>
            </div>
            <button onClick={onView} className="text-left font-medium line-clamp-1 w-full">
              {post.title}
            </button>
            <p className="opacity-70 text-sm line-clamp-2 mt-1">{post.content}</p>
          </div>
          {/* Avatar placeholder */}
          <div className="shrink-0 h-10 w-10 rounded-full bg-[var(--foreground)]/50 grid place-items-center text-sm">
            {post.author.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="flex items-center justify-between mt-4 text-xs opacity-70">
          <div className="flex items-center gap-2 flex-wrap">
            {post.tags.map((t) => (
              <span key={t} className="px-2 py-0.5 rounded-full bg-[var(--foreground)]/50">#{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span>❤ {post.likes}</span>
            <span>👁 {post.views}</span>
            <span>💬 {post.comments.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <button className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50" onClick={onView}>
            보기
          </button>
          <button className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50" onClick={onLike}>
            좋아요
          </button>
          <button className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50" onClick={onEdit}>
            수정
          </button>
          <button className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50" onClick={onTogglePin}>
            {post.pinned ? "고정 해제" : "고정"}
          </button>
          <button className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50" onClick={onDelete}>
            삭제
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function TagPicker({ selected, onChange }: { selected: string[]; onChange: (tags: string[]) => void }) {
  const [draft, setDraft] = useState("");
  return (
    <div>
      <div className="text-sm opacity-70 mb-2">태그</div>
      <div className="flex items-center gap-2 flex-wrap">
        {allTagOptions.map((t) => {
          const active = selected.includes(t);
          return (
            <button
              key={t}
              onClick={() => {
                if (active) onChange(selected.filter((x) => x !== t));
                else onChange([...selected, t]);
              }}
              className={`text-xs px-2 py-1 rounded-full border border-[var(--border)]/60 ${
                active ? "bg-[var(--hover-background)]" : "bg-[var(--foreground)]/40"
              }`}
            >
              #{t}
            </button>
          );
        })}
        <div className="flex items-center gap-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="직접 추가"
            className="h-8 px-2 rounded-lg bg-[var(--foreground)]/50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && draft.trim()) {
                const t = draft.trim();
                onChange([...new Set([...selected, t])]);
                setDraft("");
              }
            }}
          />
          <button
            className="h-8 px-3 rounded-lg bg-[var(--foreground)]/50"
            onClick={() => {
              if (!draft.trim()) return;
              const t = draft.trim();
              onChange([...new Set([...selected, t])]);
              setDraft("");
            }}
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
}

function CommentList({ comments }: { comments: Comment[] }) {
  if (!comments || comments.length === 0)
    return <div className="opacity-60 text-sm">첫 댓글을 남겨보세요.</div>;
  return (
    <div className="flex flex-col gap-3">
      {comments.map((c) => (
        <div key={c.id} className="p-3 rounded-xl bg-[var(--foreground)]/50">
          <div className="text-sm font-medium">{c.author}</div>
          <div className="text-sm opacity-80 whitespace-pre-wrap mt-1">{c.body}</div>
          <div className="text-xs opacity-60 mt-1">{new Date(c.createdAt).toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="mt-3 flex items-center gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="댓글 작성"
        className="min-h-[80px] flex-1 p-3 rounded-xl bg-[var(--foreground)]/50"
      />
      <button
        className="h-10 px-4 rounded-xl bg-[var(--hover-background)] font-medium"
        onClick={() => {
          if (!text.trim()) return;
          onSubmit(text.trim());
          setText("");
        }}
      >
        등록
      </button>
    </div>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        className="absolute inset-0 bg-[var(--foreground)]/40"
        onClick={onClose}
        aria-hidden
      />
      <motion.div
        className="relative w-[min(880px,90vw)] max-h-[85vh] overflow-y-auto rounded-2xl bg-[var(--background)] border border-[var(--border)]/60 p-5 card-shadow"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.98 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
