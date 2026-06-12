import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Heart,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";
import RequestDetailModal from "@/components/request/RequestDetailModal";

type AdminRequestsPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

type ProfileRow = {
  id: string;
  nickname: string | null;
};

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

type RequestRow = RawRequestRow & {
  nickname: string;
};

type Message = {
  type: "success" | "error";
  text: string;
};

function stripHtml(value: string | null) {
  return (value ?? "")
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

function formatUploadDate(uploadDate: string | null) {
  if (!uploadDate) return "미정";

  const [datePart] = uploadDate.split("T");
  const [yyyy, mm, dd] = datePart.split("-");

  if (!yyyy || !mm || !dd) return uploadDate;

  return `${yyyy}.${mm}.${dd}`;
}

function toDateInputValue(uploadDate: string | null) {
  if (!uploadDate) return "";
  return uploadDate.split("T")[0] ?? "";
}

export default function AdminRequestsPage({ admin }: AdminRequestsPageProps) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [dateDrafts, setDateDrafts] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestRow | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const topThreeIds = useMemo(
    () => new Set(requests.slice(0, 3).map((request) => request.id)),
    [requests]
  );

  useEffect(() => {
    void loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    const { data, error } = await supabase
      .from("requests")
      .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
      .order("like_count", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      setRequests([]);
      setDateDrafts({});
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const rawRows = (data ?? []) as RawRequestRow[];
    const userIds = Array.from(new Set(rawRows.map((request) => request.user_id)));
    const profileMap = new Map<string, ProfileRow>();

    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);

      if (!profilesError) {
        for (const profile of (profilesData ?? []) as ProfileRow[]) {
          profileMap.set(profile.id, profile);
        }
      }
    }

    const rows = rawRows.map((request) => ({
      ...request,
      nickname: profileMap.get(request.user_id)?.nickname ?? "Unknown",
    }));

    setRequests(rows);
    setDateDrafts(
      Object.fromEntries(rows.map((request) => [request.id, toDateInputValue(request.upload_date)]))
    );
    setLoading(false);
  }

  async function saveUploadDate(request: RequestRow) {
    if (!topThreeIds.has(request.id)) return;

    const uploadDate = dateDrafts[request.id]?.trim() || null;

    setSavingId(request.id);
    setMessage(null);

    const { error } = await supabase
      .from("requests")
      .update({ upload_date: uploadDate })
      .eq("id", request.id);

    if (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
      setSavingId(null);
      return;
    }

    setRequests((prev) =>
      prev.map((item) =>
        item.id === request.id
          ? {
              ...item,
              upload_date: uploadDate,
            }
          : item
      )
    );
    setSavingId(null);
    setMessage({
      type: "success",
      text: `"${request.title}" 업로드 날짜를 저장했습니다.`,
    });
  }

  async function deleteRequest(request: RequestRow) {
    const confirmed = window.confirm(`"${request.title}" 곡 신청을 삭제할까요?`);
    if (!confirmed) return;

    setDeletingId(request.id);
    setMessage(null);

    const { error } = await supabase.from("requests").delete().eq("id", request.id);

    if (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
      setDeletingId(null);
      return;
    }

    setRequests((prev) => prev.filter((item) => item.id !== request.id));
    setDateDrafts((prev) => {
      const next = { ...prev };
      delete next[request.id];
      return next;
    });
    setDeletingId(null);
    setMessage({
      type: "success",
      text: `"${request.title}" 곡 신청을 삭제했습니다.`,
    });
  }

  return (
    <>
      <Head>
        <title>Request Admin | Calmato</title>
      </Head>

      <main className="min-h-screen bg-[#0a0a0a] px-5 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-7">
          <header className="border-b border-white/10 pb-6">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
                <LockKeyhole size={14} strokeWidth={1.8} />
                Admin only
              </span>
              <Link
                href="/admin"
                className="text-xs font-medium text-white/45 transition hover:text-white/75"
              >
                Admin home
              </Link>
            </div>

            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-medium tracking-normal text-white md:text-5xl">
                  Request Admin
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                  {admin.nickname ?? "Admin"} 계정으로 곡 신청 순위를 확인하고 상위
                  3개의 업로드 날짜를 관리합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadRequests()}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.035] px-4 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                새로고침
              </button>
            </div>
          </header>

          {message && (
            <div
              className={`rounded-md border px-4 py-3 text-sm ${
                message.type === "success"
                  ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                  : "border-red-400/25 bg-red-400/10 text-red-100"
              }`}
            >
              {message.text}
            </div>
          )}

          {errorMessage && (
            <div className="rounded-md border border-red-400/25 bg-red-400/10 px-4 py-3 text-sm text-red-100">
              {errorMessage}
            </div>
          )}

          <section className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025]">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="text-base font-medium text-white">곡 신청 목록</h2>
                <p className="mt-1 text-xs text-white/40">
                  좋아요 순으로 최대 200개까지 표시합니다.
                </p>
              </div>
              <span className="text-xs text-white/40">총 {requests.length}개</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead className="border-b border-white/10 bg-white/[0.025] text-xs font-medium uppercase tracking-[0.08em] text-white/35">
                  <tr>
                    <th className="w-20 px-5 py-3">Rank</th>
                    <th className="px-5 py-3">Request</th>
                    <th className="w-28 px-5 py-3">Likes</th>
                    <th className="w-44 px-5 py-3">Current Date</th>
                    <th className="w-72 px-5 py-3">Top 3 Upload Date</th>
                    <th className="w-48 px-5 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-white/45">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          불러오는 중
                        </span>
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-14 text-center text-sm text-white/45">
                        표시할 곡 신청이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    requests.map((request, idx) => {
                      const rank = idx + 1;
                      const isTopThree = rank <= 3;
                      const isSaving = savingId === request.id;
                      const isDeleting = deletingId === request.id;
                      const contentPreview = stripHtml(request.content);

                      return (
                        <tr
                          key={request.id}
                          className={`transition ${
                            isTopThree
                              ? "bg-white/[0.035] hover:bg-white/[0.055]"
                              : "hover:bg-white/[0.035]"
                          }`}
                        >
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md border px-2 text-sm font-semibold ${
                                  isTopThree
                                    ? "border-white/20 bg-white/10 text-white"
                                    : "border-white/8 bg-white/[0.025] text-white/45"
                                }`}
                              >
                                {rank}
                              </span>
                              {isTopThree && (
                                <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/45">
                                  Top 3
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="max-w-xl">
                              <button
                                type="button"
                                onClick={() => setSelectedRequest(request)}
                                className="text-left text-sm font-medium text-white underline-offset-4 transition hover:text-white/75 hover:underline"
                              >
                                {request.title}
                              </button>
                              {request.subtitle && (
                                <p className="mt-1 text-xs text-white/50">{request.subtitle}</p>
                              )}
                              {contentPreview && (
                                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">
                                  {contentPreview}
                                </p>
                              )}
                              <p className="mt-2 text-[11px] text-white/32">
                                {request.nickname} · 신청일 {formatDateTime(request.created_at)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white/75">
                              <Heart size={15} strokeWidth={1.8} />
                              {(request.like_count ?? 0).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex items-center gap-1.5 text-sm text-white/55">
                              <CalendarClock size={15} strokeWidth={1.8} />
                              {formatUploadDate(request.upload_date)}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={dateDrafts[request.id] ?? ""}
                                onChange={(event) =>
                                  setDateDrafts((prev) => ({
                                    ...prev,
                                    [request.id]: event.target.value,
                                  }))
                                }
                                disabled={!isTopThree || isSaving}
                                className="h-10 w-36 rounded-md border border-white/10 bg-black/30 px-3 text-sm text-white/80 outline-none transition [color-scheme:dark] focus:border-white/30 disabled:cursor-not-allowed disabled:opacity-35"
                              />
                              <button
                                type="button"
                                onClick={() => void saveUploadDate(request)}
                                disabled={!isTopThree || isSaving}
                                className="inline-flex h-10 min-w-20 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.075] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                              >
                                {isSaving ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Save size={15} strokeWidth={1.8} />
                                )}
                                저장
                              </button>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedRequest(request)}
                                className="inline-flex h-10 min-w-20 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.075] hover:text-white"
                              >
                                <Eye size={15} strokeWidth={1.8} />
                                상세
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteRequest(request)}
                                disabled={isDeleting}
                                className="inline-flex h-10 min-w-20 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-red-300/15 bg-red-400/10 px-3 text-sm font-medium text-red-100/75 transition hover:border-red-300/30 hover:bg-red-400/15 hover:text-red-50 disabled:cursor-not-allowed disabled:opacity-45"
                              >
                                {isDeleting ? (
                                  <Loader2 size={15} className="animate-spin" />
                                ) : (
                                  <Trash2 size={15} strokeWidth={1.8} />
                                )}
                                삭제
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.025] px-4 py-3 text-sm leading-6 text-white/45">
            <CheckCircle2 className="mt-0.5 shrink-0 text-white/35" size={17} />
            <p>
              상위 3개 기준은 현재 좋아요 수 정렬입니다. 저장 시 해당 신청의
              `requests.upload_date` 값만 변경됩니다.
            </p>
          </div>
        </div>
      </main>

      <RequestDetailModal
        open={Boolean(selectedRequest)}
        request={
          selectedRequest
            ? {
                id: selectedRequest.id,
                title: selectedRequest.title,
                subtitle: selectedRequest.subtitle ?? "",
                content: selectedRequest.content,
                like_count: selectedRequest.like_count ?? 0,
                nickname: selectedRequest.nickname,
                created_at: selectedRequest.created_at,
              }
            : null
        }
        liked={false}
        busy={false}
        onToggleLike={async () => undefined}
        onClose={() => setSelectedRequest(null)}
        showLikeAction={false}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminRequestsPageProps> = async (
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
