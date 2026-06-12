import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Music,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

type AdminFilesPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

type ManagedBucket = {
  name: string;
  label: string;
  description: string;
};

type StorageFileItem = {
  bucket: string;
  name: string;
  path: string;
  folder: string;
  size: number | null;
  mimeType: string | null;
  updatedAt: string | null;
  publicUrl: string;
};

type Message = {
  type: "success" | "error";
  text: string;
};

type StorageListEntry = {
  id: string | null;
  name: string;
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: {
    size?: number;
    mimetype?: string;
    mimeType?: string;
  } | null;
};

const MANAGED_BUCKETS: ManagedBucket[] = [
  {
    name: "assets",
    label: "Assets",
    description: "사이트 이미지, 배너, 영상 등 정적 리소스",
  },
  {
    name: "post-images",
    label: "Post Images",
    description: "커뮤니티 게시글 첨부 이미지",
  },
  {
    name: "profile_images",
    label: "Profile Images",
    description: "사용자 프로필 이미지",
  },
  {
    name: "wallpapers",
    label: "Wallpapers",
    description: "아카이브 월페이퍼 이미지",
  },
];

function joinStoragePath(prefix: string, name: string) {
  return prefix ? `${prefix}/${name}` : name;
}

function isFolderEntry(entry: StorageListEntry) {
  return !entry.id && !entry.metadata;
}

function formatBytes(size: number | null) {
  if (!size || size <= 0) return "-";

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let idx = 0;

  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }

  return `${value.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "-";

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function getFileKind(mimeType: string | null, path: string) {
  if (mimeType?.startsWith("image/")) return "image";
  if (mimeType?.startsWith("audio/")) return "audio";
  if (mimeType?.startsWith("video/")) return "video";

  const lower = path.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif|svg)$/.test(lower)) return "image";
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/.test(lower)) return "audio";
  if (/\.(mp4|webm|mov)$/.test(lower)) return "video";

  return "file";
}

function getFileIcon(item: StorageFileItem) {
  const kind = getFileKind(item.mimeType, item.path);

  if (kind === "image") return ImageIcon;
  if (kind === "audio") return Music;
  return FileText;
}

export default function AdminFilesPage({ admin }: AdminFilesPageProps) {
  const [selectedBucket, setSelectedBucket] = useState(MANAGED_BUCKETS[0].name);
  const [files, setFiles] = useState<StorageFileItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [replacingPath, setReplacingPath] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingReplace, setPendingReplace] = useState<StorageFileItem | null>(null);

  const bucket = useMemo(
    () => MANAGED_BUCKETS.find((item) => item.name === selectedBucket) ?? MANAGED_BUCKETS[0],
    [selectedBucket]
  );

  const filteredFiles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;

    return files.filter((file) =>
      [file.path, file.folder, file.mimeType ?? ""].some((value) =>
        value.toLowerCase().includes(q)
      )
    );
  }, [files, query]);

  useEffect(() => {
    void loadFiles(selectedBucket);
  }, [selectedBucket]);

  async function listFilesRecursive(bucketName: string, prefix = ""): Promise<StorageFileItem[]> {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .list(prefix, {
        limit: 1000,
        sortBy: { column: "name", order: "asc" },
      });

    if (error) throw error;

    const entries = ((data ?? []) as StorageListEntry[]).filter(
      (entry) => entry.name !== ".emptyFolderPlaceholder"
    );
    const result: StorageFileItem[] = [];

    for (const entry of entries) {
      const path = joinStoragePath(prefix, entry.name);

      if (isFolderEntry(entry)) {
        const childFiles = await listFilesRecursive(bucketName, path);
        result.push(...childFiles);
        continue;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(path);

      result.push({
        bucket: bucketName,
        name: entry.name,
        path,
        folder: prefix || "/",
        size: entry.metadata?.size ?? null,
        mimeType: entry.metadata?.mimetype ?? entry.metadata?.mimeType ?? null,
        updatedAt: entry.updated_at ?? entry.created_at ?? null,
        publicUrl,
      });
    }

    return result;
  }

  async function loadFiles(bucketName = selectedBucket) {
    setLoading(true);
    setMessage(null);
    setErrorMessage(null);

    try {
      const nextFiles = await listFilesRecursive(bucketName);
      nextFiles.sort((a, b) => a.path.localeCompare(b.path));
      setFiles(nextFiles);
    } catch (error) {
      setFiles([]);
      setErrorMessage(error instanceof Error ? error.message : "파일 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function openReplacePicker(item: StorageFileItem) {
    setPendingReplace(item);
    fileInputRef.current?.click();
  }

  async function replaceFile(file: File | null) {
    if (!file || !pendingReplace) return;

    const target = pendingReplace;
    setReplacingPath(target.path);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.storage.from(target.bucket).upload(target.path, file, {
      upsert: true,
      contentType: file.type || target.mimeType || "application/octet-stream",
    });

    if (error) {
      setMessage({
        type: "error",
        text: error.message,
      });
      setReplacingPath(null);
      setPendingReplace(null);
      return;
    }

    setFiles((prev) =>
      prev.map((item) =>
        item.path === target.path
          ? {
              ...item,
              size: file.size,
              mimeType: file.type || item.mimeType,
              updatedAt: new Date().toISOString(),
            }
          : item
      )
    );
    setMessage({
      type: "success",
      text: `${target.bucket}/${target.path} 파일을 교체했습니다.`,
    });
    setReplacingPath(null);
    setPendingReplace(null);
  }

  return (
    <>
      <Head>
        <title>File Admin | Calmato</title>
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
                  File Admin
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                  {admin.nickname ?? "Admin"} 계정으로 Supabase Storage 파일을 확인하고
                  오디오와 썸네일을 제외한 Storage 파일을 확인하고 같은 경로의 새
                  파일로 교체합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadFiles()}
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

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {MANAGED_BUCKETS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setSelectedBucket(item.name)}
                className={`rounded-lg border p-4 text-left transition ${
                  selectedBucket === item.name
                    ? "border-white/25 bg-white/[0.075]"
                    : "border-white/10 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.045]"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <FolderOpen size={16} strokeWidth={1.8} />
                  {item.label}
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/38">
                  {item.description}
                </p>
              </button>
            ))}
          </section>

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
            <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-base font-medium text-white">{bucket.label}</h2>
                <p className="mt-1 text-xs text-white/40">
                  {bucket.name} bucket · {files.length}개 파일
                </p>
              </div>

              <label className="relative block w-full md:w-80">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  size={16}
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="path, folder, mime 검색"
                  className="h-11 w-full rounded-md border border-white/10 bg-black/25 pl-10 pr-3 text-sm text-white/80 outline-none transition placeholder:text-white/28 focus:border-white/25"
                />
              </label>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void replaceFile(file);
                event.currentTarget.value = "";
              }}
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left">
                <thead className="border-b border-white/10 bg-white/[0.025] text-xs font-medium uppercase tracking-[0.08em] text-white/35">
                  <tr>
                    <th className="w-20 px-5 py-3">Type</th>
                    <th className="px-5 py-3">File</th>
                    <th className="w-36 px-5 py-3">Size</th>
                    <th className="w-48 px-5 py-3">Updated</th>
                    <th className="w-44 px-5 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/8">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center text-sm text-white/45">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          파일 목록을 불러오는 중
                        </span>
                      </td>
                    </tr>
                  ) : filteredFiles.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center text-sm text-white/45">
                        표시할 파일이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredFiles.map((item) => {
                      const Icon = getFileIcon(item);
                      const kind = getFileKind(item.mimeType, item.path);
                      const isReplacing = replacingPath === item.path;

                      return (
                        <tr key={`${item.bucket}/${item.path}`} className="transition hover:bg-white/[0.035]">
                          <td className="px-5 py-4 align-top">
                            <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.035] text-white/55">
                              <Icon size={18} strokeWidth={1.8} />
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <div className="flex items-start gap-3">
                              {kind === "image" && (
                                <img
                                  src={item.publicUrl}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-md border border-white/10 object-cover"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="break-all text-sm font-medium text-white">
                                  {item.path}
                                </p>
                                <p className="mt-1 text-xs text-white/35">
                                  {item.mimeType ?? "unknown"} · {item.folder}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top text-sm text-white/55">
                            {formatBytes(item.size)}
                          </td>
                          <td className="px-5 py-4 align-top text-sm text-white/55">
                            {formatDateTime(item.updatedAt)}
                          </td>
                          <td className="px-5 py-4 align-top">
                            <button
                              type="button"
                              onClick={() => openReplacePicker(item)}
                              disabled={isReplacing}
                              className="inline-flex h-10 min-w-28 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-white/10 bg-white/[0.045] px-3 text-sm font-medium text-white/65 transition hover:border-white/20 hover:bg-white/[0.075] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              {isReplacing ? (
                                <Loader2 size={15} className="animate-spin" />
                              ) : (
                                <Upload size={15} strokeWidth={1.8} />
                              )}
                              교체
                            </button>
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
              교체는 기존 path를 유지한 채 Storage 객체만 덮어씁니다. DB에 저장된
              경로는 변경되지 않으므로, 같은 파일 역할을 하는 새 파일로 교체할 때
              사용해주세요.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminFilesPageProps> = async (
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
