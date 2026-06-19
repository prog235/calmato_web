import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  type ChangeEvent,
  type DragEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Save,
  Upload,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

const WALLPAPERS_BUCKET = "wallpapers";

type WallpaperFolder = "created" | "taken";

type AdminWallpapersPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
};

type WallpaperRow = {
  id: number;
  created_at: string;
  width: number | null;
  height: number | null;
  type: string | null;
  color_mode: string | null;
  image_path: string | null;
  title: string | null;
  subtitle: string | null;
};

type WallpaperFormState = {
  title: string;
  subtitle: string;
  folder: WallpaperFolder;
  width: string;
  height: string;
  type: string;
  colorMode: string;
};

const initialForm: WallpaperFormState = {
  title: "",
  subtitle: "",
  folder: "created",
  width: "",
  height: "",
  type: "",
  colorMode: "sRGB",
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function makeStoragePath(folder: WallpaperFolder, file: File) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return `${folder}/${uuid}_${safeFileName(file.name)}`;
}

function getFileType(file: File) {
  const ext = file.name.split(".").pop()?.trim().toUpperCase();
  if (ext) return ext === "JPEG" ? "JPG" : ext;

  const [, subtype] = file.type.split("/");
  return subtype ? subtype.toUpperCase() : "";
}

function getImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지 크기를 읽지 못했습니다."));
    };

    image.src = url;
  });
}

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function getPublicUrl(path: string | null) {
  if (!path) return "";
  return supabase.storage.from(WALLPAPERS_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function AdminWallpapersPage({ admin }: AdminWallpapersPageProps) {
  const [form, setForm] = useState<WallpaperFormState>(initialForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [wallpapers, setWallpapers] = useState<WallpaperRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.subtitle.trim().length > 0 &&
      form.width.trim().length > 0 &&
      form.height.trim().length > 0 &&
      form.type.trim().length > 0 &&
      form.colorMode.trim().length > 0 &&
      imageFile !== null &&
      !submitting
    );
  }, [form, imageFile, submitting]);

  useEffect(() => {
    void loadWallpapers();
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function updateField<K extends keyof WallpaperFormState>(
    key: K,
    value: WallpaperFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function loadWallpapers() {
    setLoading(true);

    const { data, error } = await supabase
      .from("wallpapers")
      .select("id, created_at, width, height, type, color_mode, image_path, title, subtitle")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage({ type: "error", text: error.message });
      setWallpapers([]);
      setLoading(false);
      return;
    }

    setWallpapers((data ?? []) as WallpaperRow[]);
    setLoading(false);
  }

  async function setSelectedImageFile(file: File | null) {
    setImageFile(file);

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setImageFile(null);
      setMessage({ type: "error", text: "이미지 파일만 업로드할 수 있습니다." });
      return;
    }

    setMessage(null);
    updateField("type", getFileType(file));

    try {
      const dimensions = await getImageDimensions(file);
      setForm((prev) => ({
        ...prev,
        width: String(dimensions.width),
        height: String(dimensions.height),
      }));
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "이미지 정보를 읽지 못했습니다.",
      });
    }
  }

  async function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    await setSelectedImageFile(event.target.files?.[0] ?? null);
  }

  function onImageDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage(true);
  }

  function onImageDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage(false);
  }

  async function onImageDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingImage(false);

    await setSelectedImageFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();

    if (!canSubmit || !imageFile) return;

    setSubmitting(true);
    setMessage(null);

    const storagePath = makeStoragePath(form.folder, imageFile);

    try {
      const { error: uploadError } = await supabase.storage
        .from(WALLPAPERS_BUCKET)
        .upload(storagePath, imageFile, {
          contentType: imageFile.type || "image/*",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("wallpapers")
        .insert({
          title: form.title.trim(),
          subtitle: form.subtitle.trim(),
          width: Number(form.width),
          height: Number(form.height),
          type: form.type.trim(),
          color_mode: form.colorMode.trim(),
          image_path: storagePath,
        })
        .select("id, created_at, width, height, type, color_mode, image_path, title, subtitle")
        .single();

      if (insertError) {
        await supabase.storage.from(WALLPAPERS_BUCKET).remove([storagePath]);
        throw insertError;
      }

      setWallpapers((prev) => [data as WallpaperRow, ...prev]);
      setForm(initialForm);
      setImageFile(null);
      setMessage({ type: "success", text: "월페이퍼가 등록되었습니다." });
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "월페이퍼 등록 중 오류가 발생했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Wallpaper Admin | Calmato</title>
      </Head>

      <main className="min-h-screen bg-[#0a0a0a] px-5 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="border-b border-white/10 pb-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
              <LockKeyhole size={14} strokeWidth={1.8} />
              Admin only
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h1 className="text-3xl font-medium tracking-normal text-white md:text-5xl">
                  Wallpaper Admin
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                  {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 월페이퍼
                  이미지를 업로드하고 `wallpapers` 테이블에 메타데이터를 저장합니다.
                </p>
              </div>
              <Link
                href="/admin"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 px-4 text-sm text-white/70 transition hover:bg-white/8 hover:text-white"
              >
                Admin Home
              </Link>
            </div>
          </header>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <form
              onSubmit={onSubmit}
              className="rounded-lg border border-white/10 bg-white/[0.035] p-5"
            >
              <div className="mb-5 flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/8">
                  <Upload size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="text-lg font-medium">월페이퍼 추가</h2>
                  <p className="mt-1 text-sm text-white/45">
                    이미지는 wallpapers 버킷의 created 또는 taken 폴더에 저장됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <label
                  className={[
                    "flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center transition",
                    isDraggingImage
                      ? "border-white/45 bg-white/[0.08]"
                      : "border-white/14 bg-black/20 hover:border-white/28 hover:bg-white/[0.045]",
                  ].join(" ")}
                  onDragOver={onImageDragOver}
                  onDragLeave={onImageDragLeave}
                  onDrop={onImageDrop}
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/8 text-white/75">
                    <Upload size={20} strokeWidth={1.8} />
                  </span>
                  <span className="mt-3 text-sm font-medium text-white/78">
                    이미지를 드래그하거나 클릭해서 업로드
                  </span>
                  <span className="mt-1 text-xs text-white/42">
                    created 또는 taken 폴더는 아래에서 선택합니다.
                  </span>
                  {imageFile ? (
                    <span className="mt-3 max-w-full truncate rounded-full bg-white/8 px-3 py-1 text-xs text-white/62">
                      {imageFile.name}
                    </span>
                  ) : null}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={onImageChange}
                    className="sr-only"
                  />
                </label>

                {previewUrl ? (
                  <div className="overflow-hidden rounded-lg border border-white/10 bg-black/30">
                    <img
                      src={previewUrl}
                      alt="선택한 월페이퍼 미리보기"
                      className="h-56 w-full object-contain"
                    />
                  </div>
                ) : null}

                <label className="block">
                  <span className="mb-2 block text-sm text-white/60">저장 폴더</span>
                  <select
                    value={form.folder}
                    onChange={(event) =>
                      updateField("folder", event.target.value as WallpaperFolder)
                    }
                    className="h-11 w-full rounded-lg border border-white/10 bg-[#111] px-3 text-sm text-white outline-none focus:border-white/30"
                  >
                    <option value="created">created</option>
                    <option value="taken">taken</option>
                  </select>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">제목</span>
                    <input
                      value={form.title}
                      onChange={(event) => updateField("title", event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">부제</span>
                    <input
                      value={form.subtitle}
                      onChange={(event) => updateField("subtitle", event.target.value)}
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">Width</span>
                    <input
                      value={form.width}
                      onChange={(event) => updateField("width", event.target.value)}
                      inputMode="numeric"
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">Height</span>
                    <input
                      value={form.height}
                      onChange={(event) => updateField("height", event.target.value)}
                      inputMode="numeric"
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">Type</span>
                    <input
                      value={form.type}
                      onChange={(event) => updateField("type", event.target.value)}
                      placeholder="JPG"
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm text-white/60">Color mode</span>
                    <input
                      value={form.colorMode}
                      onChange={(event) => updateField("colorMode", event.target.value)}
                      placeholder="sRGB"
                      className="h-11 w-full rounded-lg border border-white/10 bg-white/[0.035] px-3 text-sm text-white outline-none focus:border-white/30"
                    />
                  </label>
                </div>

                {message ? (
                  <div
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      message.type === "success"
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                        : "border-red-400/20 bg-red-400/10 text-red-200"
                    }`}
                  >
                    {message.text}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {submitting ? "저장 중..." : "월페이퍼 저장"}
                </button>
              </div>
            </form>

            <section className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-medium">등록된 월페이퍼</h2>
                  <p className="mt-1 text-sm text-white/45">
                    최근 등록 순으로 표시됩니다.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadWallpapers()}
                  className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 px-3 text-sm text-white/65 transition hover:bg-white/8 hover:text-white"
                >
                  새로고침
                </button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 py-12 text-sm text-white/50">
                  <Loader2 size={16} className="animate-spin" />
                  월페이퍼 목록을 불러오고 있습니다.
                </div>
              ) : wallpapers.length === 0 ? (
                <div className="py-12 text-sm text-white/45">
                  등록된 월페이퍼가 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {wallpapers.map((wallpaper) => {
                    const imageUrl = getPublicUrl(wallpaper.image_path);

                    return (
                      <article
                        key={wallpaper.id}
                        className="grid grid-cols-[92px_minmax(0,1fr)] gap-4 rounded-lg border border-white/8 bg-white/[0.03] p-3"
                      >
                        <div className="flex h-20 items-center justify-center overflow-hidden rounded-md bg-black/30">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageIcon size={20} className="text-white/35" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-medium text-white">
                                {wallpaper.title ?? "Untitled"}
                              </h3>
                              <p className="mt-1 truncate text-xs text-white/45">
                                {wallpaper.subtitle ?? "-"}
                              </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/8 px-2 py-1 text-[11px] text-white/55">
                              <CheckCircle2 size={12} />
                              #{wallpaper.id}
                            </span>
                          </div>
                          <dl className="mt-3 grid gap-1 text-xs text-white/45">
                            <div className="flex min-w-0 gap-2">
                              <dt className="shrink-0 text-white/30">path</dt>
                              <dd className="truncate">{wallpaper.image_path ?? "-"}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-white/30">meta</dt>
                              <dd>
                                {wallpaper.width ?? "-"} x {wallpaper.height ?? "-"} ·{" "}
                                {wallpaper.type ?? "-"} · {wallpaper.color_mode ?? "-"}
                              </dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-white/30">created</dt>
                              <dd>{formatDateTime(wallpaper.created_at)}</dd>
                            </div>
                          </dl>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminWallpapersPageProps> = async (
  ctx
) => {
  const db = supabaseServerForGSSP(ctx);

  const {
    data: { user },
    error: userError,
  } = await db.auth.getUser();

  if (userError || !user) {
    return {
      redirect: {
        destination: `/login?next=${encodeURIComponent(ctx.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const { data: profile, error: profileError } = await db
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
