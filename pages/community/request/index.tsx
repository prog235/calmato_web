import Head from "next/head";
import Image from "next/image";
import { getImage } from "@/lib/getUrl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { useRouter } from "next/router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Heart, Pencil, Search, Trash2 } from "lucide-react";
import { FaUser } from "react-icons/fa6";

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
const EMPTY_USER_ID = "00000000-0000-0000-0000-000000000000";
type RequestSort = "latest" | "likes" | "mine";

type RawRequestRow = {
  id: number;
  user_id: string;
  title: string;
  subtitle: string | null;
  content: string | null;
  created_at: string;
  upload_date: string | null;
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
  upload_date: string | null;
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
  q: string;
  sort: RequestSort;
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

function formatUploadDate(uploadDate: string) {
  const [datePart] = uploadDate.split("T");
  const [yyyy, mm, dd] = datePart.split("-");
  return `${yyyy}.${mm}.${dd}`;
}

function getUploadStatus(uploadDate: string | null) {
  if (!uploadDate) return null;

  const [datePart] = uploadDate.split("T");
  const [yyyy, mm, dd] = datePart.split("-").map(Number);
  if (!yyyy || !mm || !dd) return null;

  const deadline = new Date(yyyy, mm - 1, dd, 20, 0, 0, 0);
  const uploaded = new Date() >= deadline;

  return {
    label: uploaded ? "Uploaded" : "Upcoming",
    date: formatUploadDate(uploadDate),
    uploaded,
  };
}

function getSingleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function normalizeSearchTerm(value: string) {
  return value.trim().replace(/[,()]/g, " ");
}

function normalizeRequestSort(value: string | string[] | undefined): RequestSort {
  const sort = getSingleQueryValue(value);
  if (sort === "likes" || sort === "mine") return sort;
  return "latest";
}

function buildListQuery(params: { page?: number; q?: string; sort: RequestSort }) {
  const query: Record<string, string> = {};
  const q = params.q?.trim() ?? "";

  if (q) query.q = q;
  if (params.sort !== "latest") query.sort = params.sort;
  if (params.page && params.page > 1) query.page = String(params.page);

  return query;
}

function buildRequestSearchOr(q: string, authorIds: string[]) {
  const term = normalizeSearchTerm(q);
  if (!term) return null;

  const clauses = [`title.ilike.%${term}%`, `subtitle.ilike.%${term}%`];

  if (authorIds.length > 0) {
    clauses.push(`user_id.in.(${authorIds.join(",")})`);
  }

  return clauses.join(",");
}

async function getMatchingAuthorIds(db: SupabaseClient, q: string) {
  const term = normalizeSearchTerm(q);
  if (!term) return [];

  const { data, error } = await db
    .from("profiles")
    .select("id")
    .ilike("nickname", `%${term}%`);

  if (error) {
    console.error("[RequestPage] profile search error:", error);
    return [];
  }

  return ((data as { id: string }[] | null) ?? []).map((row) => row.id);
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
    upload_date: row.upload_date ?? null,
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
    .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
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
  excludedIds: number[],
  searchOr: string | null,
  viewerId: string | null
) {
  let query = db.from("requests").select("id", { count: "exact", head: true });

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  if (searchOr) {
    query = query.or(searchOr);
  }

  if (viewerId !== null) {
    query = query.eq("user_id", viewerId);
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
  page: number,
  searchOr: string | null,
  sort: RequestSort,
  viewerId: string | null
): Promise<RawRequestRow[]> {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = db
    .from("requests")
    .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
    .range(from, to);

  if (excludedIds.length > 0) {
    query = query.not("id", "in", `(${excludedIds.join(",")})`);
  }

  if (searchOr) {
    query = query.or(searchOr);
  }

  if (viewerId !== null) {
    query = query.eq("user_id", viewerId);
  }

  if (sort === "likes") {
    query = query
      .order("like_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
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
  const q = normalizeSearchTerm(getSingleQueryValue(ctx.query.q));
  const sort = normalizeRequestSort(ctx.query.sort);

  const rawTopRequests = await getTopRequests(db);
  const topIds = rawTopRequests.map((row) => row.id);
  const authorIds = await getMatchingAuthorIds(db, q);
  const searchOr = buildRequestSearchOr(q, authorIds);
  const viewerIdFilter = sort === "mine" ? user?.id ?? EMPTY_USER_ID : null;

  const remainingCount = await countRemainingRequests(
    db,
    topIds,
    searchOr,
    viewerIdFilter
  );
  const totalPages = Math.max(1, Math.ceil(remainingCount / PAGE_SIZE));
  const clampedPage = Math.min(currentPage, totalPages);

  const rawListRequests = await getRemainingRequestsPage(
    db,
    topIds,
    clampedPage,
    searchOr,
    sort,
    viewerIdFilter
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
      q,
      sort,
    },
  };
};

type RequestCardProps = {
  item: RequestItem;
  liked: boolean;
  busy: boolean;
  isOwn: boolean;
  actionBusy: boolean;
  onToggleLike: (requestId: number) => Promise<void>;
  onOpenDetail: (item: RequestItem) => void;
  onEdit: (item: RequestItem) => void;
  onDelete: (item: RequestItem) => Promise<void>;
};

function RequestTopCard({
  item,
  liked,
  busy,
  isOwn,
  actionBusy,
  onToggleLike,
  onOpenDetail,
  onEdit,
  onDelete,
}: RequestCardProps) {
  const uploadStatus = getUploadStatus(item.upload_date);

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
        <span className={styles.topCardAuthor}>
          <FaUser size={12} aria-hidden="true" />
          <span>{item.nickname}</span>
        </span>
        <span className={styles.topCardMetaRight}>
          <span className="date">{formatDate(item.created_at)}</span>
          {isOwn ? (
            <span className={styles.requestActions}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(item);
                }}
                disabled={actionBusy}
                aria-label="곡 신청 수정"
              >
                <Pencil size={13} strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void onDelete(item);
                }}
                disabled={actionBusy}
                aria-label="곡 신청 삭제"
              >
                <Trash2 size={13} strokeWidth={1.8} />
              </button>
            </span>
          ) : null}
        </span>
      </div>

      <h3 className={styles.topCardTitle}>
        <span>{item.title}</span>
        {item.subtitle ? (
          <>
            <span className={styles.titleDot}>·</span>
            <span className={styles.topCardSubtitle}>{item.subtitle}</span>
          </>
        ) : null}
      </h3>
      <p className={styles.topCardBody}>
        {item.content.trim() ? item.content : "등록된 요청사항이 없습니다"}
      </p>

      <div className={styles.topCardBottom}>
        {uploadStatus ? (
          <span
            className={`${styles.uploadBadge} ${
              uploadStatus.uploaded ? styles.uploaded : styles.upcoming
            }`}
          >
            <span className={styles.statusDot} />
            <span>
              {uploadStatus.label} {uploadStatus.date}
            </span>
          </span>
        ) : (
          <span />
        )}

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
          <Heart
            size={18}
            className={liked ? styles.heartActive : styles.heartIcon}
          />
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
  isOwn: boolean;
  actionBusy: boolean;
  onToggleLike: (requestId: number) => Promise<void>;
  onOpenDetail: (item: RequestItem) => void;
  onEdit: (item: RequestItem) => void;
  onDelete: (item: RequestItem) => Promise<void>;
};

function RequestListRow({
  item,
  liked,
  busy,
  isOwn,
  actionBusy,
  onToggleLike,
  onOpenDetail,
  onEdit,
  onDelete,
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
          <Heart
            size={16}
            className={liked ? styles.heartActive : styles.heartIcon}
          />
          <span>{item.like_count.toLocaleString()}</span>
        </button>
      </td>
      <td className={styles.actionCell}>
        {isOwn ? (
          <span className={styles.requestActions}>
            <button
              type="button"
              onClick={() => onEdit(item)}
              disabled={actionBusy}
              aria-label="곡 신청 수정"
            >
              <Pencil size={14} strokeWidth={1.8} />
            </button>
            <button
              type="button"
              onClick={() => void onDelete(item)}
              disabled={actionBusy}
              aria-label="곡 신청 삭제"
            >
              <Trash2 size={14} strokeWidth={1.8} />
            </button>
          </span>
        ) : null}
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
  q,
  sort,
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
  const [requestActionBusyId, setRequestActionBusyId] = useState<number | null>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<RequestItem | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(
    null
  );
  const [totalPagesState, setTotalPagesState] = useState(totalPages);
  const [search, setSearch] = useState(q);

  useEffect(() => {
    setTopRequests(initialTopRequests);
    setListRequests(initialListRequests);
    setLikedSet(new Set(likedRequestIds));
  }, [initialTopRequests, initialListRequests, likedRequestIds]);

  useEffect(() => {
    setTotalPagesState(totalPages);
  }, [totalPages]);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  const pageNumbers = useMemo(() => {
    return Array.from({ length: totalPagesState }, (_, idx) => idx + 1);
  }, [totalPagesState]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    void router.push({
      pathname: "/community/request",
      query: buildListQuery({ q: search, sort }),
    });
  }

  function changeSort(nextSort: RequestSort) {
    if (nextSort === "mine" && !currentUserId) {
      setLoginModalOpen(true);
      return;
    }

    void router.push({
      pathname: "/community/request",
      query: buildListQuery({ q: search, sort: nextSort }),
    });
  }

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
      .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
      .order("like_count", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (error) throw error;
    return (data as RawRequestRow[] | null) ?? [];
  }

  async function fetchClientRemainingCount(
    excludedIds: number[],
    searchOr: string | null,
    viewerId: string | null
  ) {
    let query = supabase
      .from("requests")
      .select("id", { count: "exact", head: true });

    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    if (searchOr) {
      query = query.or(searchOr);
    }

    if (viewerId !== null) {
      query = query.eq("user_id", viewerId);
    }

    const { count, error } = await query;
    if (error) throw error;
    return count ?? 0;
  }

  async function fetchClientRemainingPage(
    excludedIds: number[],
    page: number,
    searchOr: string | null,
    viewerId: string | null
  ) {
    const safePage = Math.max(1, page);
    const from = (safePage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("requests")
      .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
      .range(from, to);

    if (excludedIds.length > 0) {
      query = query.not("id", "in", `(${excludedIds.join(",")})`);
    }

    if (searchOr) {
      query = query.or(searchOr);
    }

    if (viewerId !== null) {
      query = query.eq("user_id", viewerId);
    }

    if (sort === "likes") {
      query = query
        .order("like_count", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
    } else {
      query = query.order("created_at", { ascending: false });
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data as RawRequestRow[] | null) ?? [];
  }

  async function refreshVisibleData() {
    try {
      const rawTopRequests = await fetchClientTopRequests();
      const topIds = rawTopRequests.map((row) => row.id);
      const authorIds = await getMatchingAuthorIds(supabase, q);
      const searchOr = buildRequestSearchOr(q, authorIds);
      const viewerIdFilter =
        sort === "mine" ? currentUserId ?? EMPTY_USER_ID : null;

      const remainingCount = await fetchClientRemainingCount(
        topIds,
        searchOr,
        viewerIdFilter
      );
      const nextTotalPages = Math.max(1, Math.ceil(remainingCount / PAGE_SIZE));
      const clampedPage = Math.min(currentPage, nextTotalPages);

      const rawListRequests = await fetchClientRemainingPage(
        topIds,
        clampedPage,
        searchOr,
        viewerIdFilter
      );

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

      if (
        currentPage === 1 &&
        !q &&
        (sort === "latest" || sort === "mine")
      ) {
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

  async function handleUpdated(updated: CreatedRequestRow) {
    try {
      const [updatedItem] = await attachNicknames(supabase, [updated]);
      if (!updatedItem) return;

      setTopRequests((prev) =>
        prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      setListRequests((prev) =>
        prev.map((item) => (item.id === updatedItem.id ? updatedItem : item))
      );
      setSelectedRequest((prev) =>
        prev && prev.id === updatedItem.id ? updatedItem : prev
      );

      void refreshVisibleData();
    } catch (error) {
      console.error(error);
      void refreshVisibleData();
    }
  }

  function openEditRequest(item: RequestItem) {
    if (!currentUserId || item.user_id !== currentUserId) return;

    setSelectedRequest(null);
    setEditingRequest(item);
    setIsCreateModalOpen(true);
  }

  async function deleteRequest(item: RequestItem) {
    if (!currentUserId || item.user_id !== currentUserId) return;
    if (requestActionBusyId !== null) return;

    const confirmed = window.confirm(`"${item.title}" 곡 신청을 삭제할까요?`);
    if (!confirmed) return;

    setRequestActionBusyId(item.id);

    try {
      const { error } = await supabase
        .from("requests")
        .delete()
        .eq("id", item.id)
        .eq("user_id", currentUserId);

      if (error) throw error;

      setTopRequests((prev) => prev.filter((request) => request.id !== item.id));
      setListRequests((prev) => prev.filter((request) => request.id !== item.id));
      setSelectedRequest((prev) => (prev?.id === item.id ? null : prev));
      setLikedSet((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      void refreshVisibleData();
    } catch (error) {
      console.error(error);
      alert("곡 신청 삭제 중 오류가 발생했습니다.");
    } finally {
      setRequestActionBusyId(null);
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
                isOwn={item.user_id === currentUserId}
                actionBusy={requestActionBusyId === item.id}
                onToggleLike={toggleLike}
                onOpenDetail={setSelectedRequest}
                onEdit={openEditRequest}
                onDelete={deleteRequest}
              />
            ))}
          </div>
        </section>

        <section className={styles.listSection}>
          <div className={styles.listHeader}>
            <div>
              <h2>곡 신청 목록</h2>
              <p>Top3를 제외한 신청곡들입니다.</p>
            </div>

            <div className={styles.listControls}>
              <label className={styles.sortSelectWrap}>
                <span className="sr-only">곡 신청 정렬 기준</span>
                <select
                  value={sort}
                  onChange={(e) => changeSort(e.target.value as RequestSort)}
                  className={styles.sortSelect}
                >
                  <option value="latest">최신 순</option>
                  <option value="likes">좋아요 순</option>
                  <option value="mine">내 신청곡</option>
                </select>
              </label>

              <form onSubmit={submitSearch} className={styles.searchForm}>
                <Search size={15} className={styles.searchIcon} aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="작성자, 제목, 부제목 검색"
                  className={styles.searchInput}
                />
              </form>
            </div>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.requestTable}>
              <thead>
                <tr>
                  <th>곡 제목</th>
                  <th>작성자</th>
                  <th>작성일</th>
                  <th>좋아요</th>
                  <th>관리</th>
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
                      isOwn={item.user_id === currentUserId}
                      actionBusy={requestActionBusyId === item.id}
                      onToggleLike={toggleLike}
                      onOpenDetail={setSelectedRequest}
                      onEdit={openEditRequest}
                      onDelete={deleteRequest}
                    />
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className={styles.emptyRow}>
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
                    query: buildListQuery({ page, q, sort }),
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
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingRequest(null);
        }}
        initialRequest={editingRequest}
        onCreated={handleCreated}
        onUpdated={handleUpdated}
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
                nickname: selectedRequest.nickname,
                created_at: selectedRequest.created_at,
              }
            : null
        }
        liked={selectedRequest ? likedSet.has(selectedRequest.id) : false}
        busy={selectedRequest ? busyId === selectedRequest.id : false}
        onToggleLike={toggleLike}
        onClose={() => setSelectedRequest(null)}
        isOwn={selectedRequest?.user_id === currentUserId}
        actionBusy={
          selectedRequest ? requestActionBusyId === selectedRequest.id : false
        }
        onEdit={() => {
          if (selectedRequest) openEditRequest(selectedRequest);
        }}
        onDelete={async () => {
          if (selectedRequest) await deleteRequest(selectedRequest);
        }}
      />

      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        nextPath={router.asPath}
      />

    </>
  );
}
