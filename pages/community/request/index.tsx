import Head from "next/head";
import Image from "next/image";
import { getImage } from "@/lib/getUrl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import type { SupabaseClient } from "@supabase/supabase-js";

import CommunityTabs from "@/components/CommunityTabs";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import RequestCreateModal, {
  type CreatedRequestRow,
} from "@/components/request/RequestCreateModal";
import RequestDetailModal from "@/components/request/RequestDetailModal";

import { supabase } from "@/lib/supabaseClient";
import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import heroStyles from "@/styles/communityHero.module.css";
import styles from "@/styles/requestPage.module.css";

const PAGE_SIZE = 10;
const REQUEST_BANNER_SRC = getImage("assets", "banners/community_banner.jpg")

type RawRequestRow = {
  id: number;
  user_id: string;
  title: string;
  subtitle: string | null;
  content: string | null;
  created_at: string;
  like_count: number | null;
};

type ProfileRow = {
  id: string;
  nickname: string | null;
};

export type RequestItem = {
  id: number;
  user_id: string;
  title: string;
  subtitle: string;
  content: string;
  created_at: string;
  like_count: number;
  nickname: string;
};

type PageProps = {
  currentUserId: string | null;
  topRequests: RequestItem[];
  listRequests: RequestItem[];
  likedRequestIds: number[];
  currentPage: number;
  totalPages: number;
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  const yyyy = d.getFullYear();
  const mm = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  const hh = `${d.getHours()}`.padStart(2, "0");
  const mi = `${d.getMinutes()}`.padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
}

function excerpt(text: string, max = 92) {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}...`;
}

async function attachNicknames(
  db: SupabaseClient,
  rows: RawRequestRow[]
): Promise<RequestItem[]> {
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((row) => row.user_id)));

  const { data: profilesData, error: profilesError } = await db
    .from("profiles")
    .select("id, nickname")
    .in("id", userIds);

  const profileMap = new Map<string, string>();

  if (!profilesError) {
    for (const profile of (profilesData as ProfileRow[] | null) ?? []) {
      profileMap.set(profile.id, profile.nickname ?? "Unknown");
    }
  }

  return rows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    subtitle: row.subtitle ?? "",
    content: row.content ?? "",
    created_at: row.created_at,
    like_count: row.like_count ?? 0,
    nickname: profileMap.get(row.user_id) ?? "Unknown",
  }));
}

async function getLikedRequestIds(
  db: SupabaseClient,
  userId: string,
  requestIds: number[]
): Promise<number[]> {
  if (requestIds.length === 0) return [];

  const { data, error } = await db
    .from("request_likes")
    .select("request_id")
    .eq("user_id", userId)
    .in("request_id", requestIds);

  if (error) {
    throw error;
  }

  return ((data as { request_id: number }[] | null) ?? []).map(
    (row) => row.request_id
  );
}

async function getTopRequests(db: SupabaseClient): Promise<RawRequestRow[]> {
  const { data, error } = await db
    .from("requests")
    .select("id, user_id, title, subtitle, content, created_at, like_count")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(3);

  if (error) {
    throw error;
  }

  return (data as RawRequestRow[] | null) ?? [];
}

async function countRemainingRequests(
  db: SupabaseClient,
  excludedIds: number[]
) {
  let query = db.from("requests").select("id", { count: "exact", head: true });

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  const { count, error } = await query;
  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getRemainingRequestsPage(
  db: SupabaseClient,
  excludedIds: number[],
  page: number
): Promise<RawRequestRow[]> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db
    .from("requests")
    .select("id, user_id, title, subtitle, content, created_at, like_count")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as RawRequestRow[] | null) ?? [];
}

export const getServerSideProps: GetServerSideProps<PageProps> = async (ctx) => {
  const db = supabaseServerForGSSP(ctx);

  const {
    data: { user },
  } = await db.auth.getUser();

  const rawPage = Array.isArray(ctx.query.page)
    ? ctx.query.page[0]
    : ctx.query.page;
  const currentPage = Math.max(1, Number(rawPage ?? "1") || 1);

  const rawTopRequests = await getTopRequests(db);
  const topIds = rawTopRequests.map((row) => row.id);

  const remainingCount = await countRemainingRequests(db, topIds);
  const totalPages = Math.max(1, Math.ceil(remainingCount / PAGE_SIZE));
  const clampedPage = Math.min(currentPage, totalPages);

  const rawListRequests = await getRemainingRequestsPage(
    db,
    topIds,
    clampedPage
  );

  const [topRequests, listRequests] = await Promise.all([
    attachNicknames(db, rawTopRequests),
    attachNicknames(db, rawListRequests),
  ]);

  const allVisibleIds = [...topRequests, ...listRequests].map(
    (item) => item.id
  );
  const likedRequestIds = user
    ? await getLikedRequestIds(db, user.id, allVisibleIds)
    : [];

  return {
    props: {
      currentUserId: user?.id ?? null,
      topRequests,
      listRequests,
      likedRequestIds,
      currentPage: clampedPage,
      totalPages,
    },
  };
};

type RequestCardProps = {
  item: RequestItem;
  liked: boolean;
  busy: boolean;
  onToggleLike: (requestId: number) => Promise<void>;
  onOpenDetail: (item: RequestItem) => void;
};

function RequestTopCard({
  item,
  liked,
  busy,
  onToggleLike,
  onOpenDetail,
}: RequestCardProps) {
  return (
    <article
      className={styles.topCard}
      onClick={() => onOpenDetail(item)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetail(item);
        }
      }}
    >
      <div className={styles.topCardMeta}>
        <span className="writer">{item.nickname}</span>
        <span className="date">{formatDate(item.created_at)}</span>
      </div>

      <h3 className={styles.topCardTitle}>{item.title}</h3>
      <p className={styles.topCardSubtitle}>{item.subtitle}</p>
      <p className={styles.topCardBody}>{excerpt(item.content, 120)}</p>

      <div className={styles.topCardBottom}>
        <span className={styles.badge}>Top Request</span>

        <button
          type="button"
          className={`${styles.likeButton} ${liked ? styles.liked : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            void onToggleLike(item.id);
          }}
          disabled={busy}
          aria-label={liked ? "좋아요 취소" : "좋아요"}
        >
          <span className={styles.heart}>{liked ? "♥" : "♡"}</span>
          <span>{item.like_count.toLocaleString()}</span>
        </button>
      </div>
    </article>
  );
}

type RequestListRowProps = {
  item: RequestItem;
  liked: boolean;
  busy: boolean;
  onToggleLike: (requestId: number) => Promise<void>;
  onOpenDetail: (item: RequestItem) => void;
};

function RequestListRow({
  item,
  liked,
  busy,
  onToggleLike,
  onOpenDetail,
}: RequestListRowProps) {
  return (
    <tr>
      <td className={styles.titleCell}>
        <button
          type="button"
          className={styles.titleLinkButton}
          onClick={() => onOpenDetail(item)}
        >
          <span className={styles.titleLink}>{item.title}</span>
          <span className={styles.titleSub}>{item.subtitle}</span>
        </button>
      </td>
      <td>{item.nickname}</td>
      <td>{formatDate(item.created_at)}</td>
      <td className={styles.likeCell}>
        <button
          type="button"
          className={`${styles.likeButton} ${liked ? styles.liked : ""}`}
          onClick={() => void onToggleLike(item.id)}
          disabled={busy}
          aria-label={liked ? "좋아요 취소" : "좋아요"}
        >
          <span className={styles.heart}>{liked ? "♥" : "♡"}</span>
          <span>{item.like_count.toLocaleString()}</span>
        </button>
      </td>
    </tr>
  );
}

export default function RequestPage({
  currentUserId,
  topRequests: initialTopRequests,
  listRequests: initialListRequests,
  likedRequestIds,
  currentPage,
  totalPages,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();

  const [topRequests, setTopRequests] =
    useState<RequestItem[]>(initialTopRequests);
  const [listRequests, setListRequests] =
    useState<RequestItem[]>(initialListRequests);
  const [likedSet, setLikedSet] = useState<Set<number>>(
    new Set(likedRequestIds)
  );
  const [busyId, setBusyId] = useState<number | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(
    null
  );
  const [totalPagesState, setTotalPagesState] = useState(totalPages);

  useEffect(() => {
    setTopRequests(initialTopRequests);
    setListRequests(initialListRequests);
    setLikedSet(new Set(likedRequestIds));
  }, [initialTopRequests, initialListRequests, likedRequestIds]);

  useEffect(() => {
    setTotalPagesState(totalPages);
  }, [totalPages]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPagesState }, (_, idx) => idx + 1);
  }, [totalPagesState]);

  const updateLikeCountInState = (requestId: number, delta: 1 | -1) => {
    setTopRequests((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? { ...item, like_count: Math.max(0, item.like_count + delta) }
          : item
      )
    );

    setListRequests((prev) =>
      prev.map((item) =>
        item.id === requestId
          ? { ...item, like_count: Math.max(0, item.like_count + delta) }
          : item
      )
    );

    setSelectedRequest((prev) =>
      prev && prev.id === requestId
        ? { ...prev, like_count: Math.max(0, prev.like_count + delta) }
        : prev
    );
  };

  async function fetchClientTopRequests() {
    const { data, error } = await supabase
      .from("requests")
      .select("id, user_id, title, subtitle, content, created_at, like_count")
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) throw error;
    return (data as RawRequestRow[] | null) ?? [];
  }

  async function fetchClientRemainingCount(excludedIds: number[]) {
    let query = supabase
      .from("requests")
      .select("id", { count: "exact", head: true });

    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async function fetchClientRemainingPage(excludedIds: number[], page: number) {
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("requests")
      .select("id, user_id, title, subtitle, content, created_at, like_count")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as RawRequestRow[] | null) ?? [];
  }

  async function refreshVisibleData() {
    try {
      const rawTopRequests = await fetchClientTopRequests();
      const topIds = rawTopRequests.map((row) => row.id);

      const remainingCount = await fetchClientRemainingCount(topIds);
      const nextTotalPages = Math.max(1, Math.ceil(remainingCount / PAGE_SIZE));
      const clampedPage = Math.min(currentPage, nextTotalPages);

      const rawListRequests = await fetchClientRemainingPage(topIds, clampedPage);

      const [nextTopRequests, nextListRequests] = await Promise.all([
        attachNicknames(supabase, rawTopRequests),
        attachNicknames(supabase, rawListRequests),
      ]);

      const allVisibleIds = [...nextTopRequests, ...nextListRequests].map(
        (item) => item.id
      );

      const nextLikedIds = currentUserId
        ? await getLikedRequestIds(supabase, currentUserId, allVisibleIds)
        : [];

      setTopRequests(nextTopRequests);
      setListRequests(nextListRequests);
      setLikedSet(new Set(nextLikedIds));
      setTotalPagesState(nextTotalPages);

      setSelectedRequest((prev) => {
        if (!prev) return null;
        const found =
          nextTopRequests.find((item) => item.id === prev.id) ??
          nextListRequests.find((item) => item.id === prev.id);
        return found ?? prev;
      });
    } catch (error) {
      console.error(error);
    }
  }

  async function handleCreated(created: CreatedRequestRow) {
    try {
      const [createdItem] = await attachNicknames(supabase, [created]);
      if (!createdItem) return;

      if (currentPage === 1) {
        setListRequests((prev) => {
          const withoutDuplicate = prev.filter(
            (item) => item.id !== createdItem.id
          );
          return [createdItem, ...withoutDuplicate].slice(0, PAGE_SIZE);
        });

        setLikedSet((prev) => {
          const next = new Set(prev);
          next.delete(createdItem.id);
          return next;
        });
      }

      void refreshVisibleData();
    } catch (error) {
      console.error(error);
      void refreshVisibleData();
    }
  }

  const toggleLike = async (requestId: number) => {
    if (!currentUserId) {
      setLoginModalOpen(true);
      return;
    }

    if (busyId !== null) return;

    const alreadyLiked = likedSet.has(requestId);
    const delta: 1 | -1 = alreadyLiked ? -1 : 1;

    setBusyId(requestId);

    setLikedSet((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) {
        next.delete(requestId);
      } else {
        next.add(requestId);
      }
      return next;
    });
    updateLikeCountInState(requestId, delta);

    try {
      if (alreadyLiked) {
        const { error: deleteLikeError } = await supabase
          .from("request_likes")
          .delete()
          .eq("request_id", requestId)
          .eq("user_id", currentUserId);

        if (deleteLikeError) throw deleteLikeError;
      } else {
        const { error: insertLikeError } = await supabase
          .from("request_likes")
          .insert({
            request_id: requestId,
            user_id: currentUserId,
          });

        if (insertLikeError) throw insertLikeError;
      }

      void refreshVisibleData();
    } catch (error) {
      setLikedSet((prev) => {
        const next = new Set(prev);
        if (alreadyLiked) {
          next.add(requestId);
        } else {
          next.delete(requestId);
        }
        return next;
      });
      updateLikeCountInState(requestId, alreadyLiked ? 1 : -1);

      console.error(error);
      alert("좋아요 처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Track Request | Calmato</title>
      </Head>

      <main className="mb-16 px-8 sm:px-12 md:px-16">
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
              <p>여러분이 간직했던 선곡을 나누는 공간입니다</p>
              <p>천천히 이야기를 남겨 주세요</p>
            </div>
          </div>
        </section>

        <section className={heroStyles.tabsSection}>
          <CommunityTabs current="request" />
        </section>

        <section className={styles.topSection}>
          <div className={styles.sectionHeader}>
            <div>
              <h2>추천이 많이 모인 곡</h2>
              <p>가장 많은 공감을 받은 세 곡을 먼저 보여드립니다.</p>
            </div>

            <button
              type="button"
              className={styles.writeButton}
              onClick={() => {
                if (!currentUserId) {
                  setLoginModalOpen(true);
                  return;
                }

                setIsCreateModalOpen(true);
              }}
            >
              곡 신청하기
            </button>
          </div>

          <div className={styles.topGrid}>
            {topRequests.map((item) => (
              <RequestTopCard
                key={item.id}
                item={item}
                liked={likedSet.has(item.id)}
                busy={busyId === item.id}
                onToggleLike={toggleLike}
                onOpenDetail={setSelectedRequest}
              />
            ))}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeader}>
            <h2>곡 신청 목록</h2>
            <p>Top 3를 제외한 나머지 곡 신청들을 최신순으로 보여줍니다.</p>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.requestTable}>
              <thead>
                <tr>
                  <th>곡 제목</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>좋아요</th>
                </tr>
              </thead>
              <tbody>
                {listRequests.length > 0 ? (
                  listRequests.map((item) => (
                    <RequestListRow
                      key={item.id}
                      item={item}
                      liked={likedSet.has(item.id)}
                      busy={busyId === item.id}
                      onToggleLike={toggleLike}
                      onOpenDetail={setSelectedRequest}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className={styles.emptyRow}>
                      아직 등록된 곡 신청이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <nav className={styles.pagination} aria-label="Request pagination">
            {pageNumbers.map((page) => {
              const isActive = page === currentPage;
              return (
                <Link
                  key={page}
                  href={{
                    pathname: "/community/request",
                    query: { page },
                  }}
                  className={`${styles.pageLink} ${
                    isActive ? styles.pageLinkActive : ""
                  }`}
                >
                  {page}
                </Link>
              );
            })}
          </nav>
        </section>
      </main>

      <RequestCreateModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={handleCreated}
      />

      <RequestDetailModal
        open={!!selectedRequest}
        request={
          selectedRequest
            ? {
                id: selectedRequest.id,
                title: selectedRequest.title,
                subtitle: selectedRequest.subtitle,
                content: selectedRequest.content,
                like_count: selectedRequest.like_count,
                created_at: selectedRequest.created_at,
              }
            : null
        }
        onClose={() => setSelectedRequest(null)}
      />

      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        nextPath={router.asPath}
      />

    </>
  );
}
