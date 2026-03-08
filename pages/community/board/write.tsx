// pages/community/write.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient"; // createBrowserClient 기반

const POST_IMAGES_BUCKET = "post-images"; // 실제 버킷명으로 변경
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 10;

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}MB`;
}

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function makeObjectPath(postId: number, file: File) {
  // 요구사항: post### 폴더
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fname = safeFileName(file.name);
  return `post${postId}/${stamp}_${uuid}_${fname}`;
}

export default function WritePage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSecret, setIsSecret] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const nextUrl = useMemo(() => "/community/write", []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data } = await supabase.auth.getUser();
      const u = data.user;

      if (cancelled) return;

      if (!u) {
        alert("로그인이 필요한 페이지입니다.");
        router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
        return;
      }

      setUserId(u.id);
      setReady(true);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [router, nextUrl]);

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;

    const picked = Array.from(list);
    const merged = [...files, ...picked].slice(0, MAX_FILES);

    setFiles(merged);
    e.target.value = "";
  }

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  async function uploadImages(postId: number, uploadFiles: File[]) {
    const uploadedPaths: string[] = [];

    try {
      for (const f of uploadFiles) {
        const storagePath = makeObjectPath(postId, f);

        const { error } = await supabase.storage.from(POST_IMAGES_BUCKET).upload(storagePath, f, {
          upsert: false,
          contentType: f.type || "application/octet-stream",
        });

        if (error) throw error;
        uploadedPaths.push(storagePath);
      }

      return uploadedPaths;
    } catch (err) {
      // best-effort cleanup
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(POST_IMAGES_BUCKET).remove(uploadedPaths);
      }
      throw err;
    }
  }

  async function insertPostImages(postId: number, paths: string[]) {
    if (paths.length === 0) return;

    const rows = paths.map((p, idx) => ({
      post_id: postId,
      storage_path: p,
      sort_order: idx,
    }));

    const { error } = await supabase.from("post_images").insert(rows);
    if (error) throw error;
  }

  async function onSubmit() {
    if (submitting) return;

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();

    if (!trimmedTitle) {
      alert("제목을 입력해 주세요.");
      return;
    }

    if (!trimmedContent) {
      alert("내용을 입력해 주세요.");
      return;
    }

    if (!userId) {
      alert("로그인이 필요한 페이지입니다.");
      router.replace(`/login?next=${encodeURIComponent(nextUrl)}`);
      return;
    }

    if (files.length > MAX_FILES) {
      alert(`이미지는 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    for (const f of files) {
      const sizeMb = f.size / (1024 * 1024);
      if (sizeMb > MAX_FILE_SIZE_MB) {
        alert(`파일이 너무 큽니다: ${f.name} (${formatBytes(f.size)})`);
        return;
      }
      if (!f.type.startsWith("image/")) {
        alert(`이미지 파일만 첨부할 수 있어요: ${f.name}`);
        return;
      }
    }

    setSubmitting(true);

    // 1) posts insert → postId 확보
    const { data: inserted, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: trimmedTitle,
        content: trimmedContent,
        is_secret: isSecret,
      })
      .select("id, user_id")
      .single();


    console.log("posts insert inserted:", inserted); // { id: 4, user_id: "..." } 떠야 정상
    console.log("userId state:", userId);

    if (insertError || !inserted?.id) {
      setSubmitting(false);
      alert(`posts insert 실패: ${insertError?.message ?? "unknown"}`);
      return;
    }

    const postId = inserted.id as number;
    let uploadedPaths: string[] = [];

    try {
      // 2) 이미지 업로드 (optional)
      if (files.length > 0) {
        uploadedPaths = await uploadImages(postId, files);
      }

      // 3) post_images insert
      if (uploadedPaths.length > 0) {
        await insertPostImages(postId, uploadedPaths);
      }

      router.push("/community/board");
    } catch (err) {
      // 실패 시 best-effort 정리
      try {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(POST_IMAGES_BUCKET).remove(uploadedPaths);
        }
      } catch {
        // ignore
      }

      try {
        await supabase.from("post_images").delete().eq("post_id", postId);
      } catch {
        // ignore
      }

      await supabase.from("posts").delete().eq("id", postId);

      setSubmitting(false);
      alert("이미지 업로드 또는 등록 처리 중 오류가 발생했습니다.");
    }
  }

  if (!ready) {
    return (
      <>
        <Head>
          <title>Calmato | Write</title>
        </Head>
        <div className="min-h-screen bg-black text-white" />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Calmato | 글 남기기</title>
      </Head>

      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-5xl px-6 pt-24 pb-20">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
            <div className="mb-6 text-xl font-semibold text-white/90">글 남기기</div>

            {/* Title */}
            <div className="mb-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력해 주세요"
                className="h-12 w-full rounded-xl bg-white/5 px-4 text-sm text-white/90 ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
            </div>

            {/* Toolbar */}
            <div className="mb-2 flex items-center justify-between rounded-xl bg-white/5 px-3 py-2 ring-1 ring-white/10">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-white/80 ring-1 ring-white/10 transition hover:bg-white/10"
                  title="사진 첨부"
                >
                  <span className="text-lg">▣</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  className="hidden"
                />

                <div className="text-xs text-white/50">
                  사진 {files.length}/{MAX_FILES}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-white/10"
                />
                비밀글
              </label>
            </div>

            {/* Selected files */}
            {files.length > 0 && (
              <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-2 text-xs text-white/55">첨부된 사진</div>
                <div className="flex flex-col gap-2">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}_${idx}`}
                      className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-2 ring-1 ring-white/10"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/80">{f.name}</div>
                        <div className="text-xs text-white/45">{formatBytes(f.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70 ring-1 ring-white/10 transition hover:bg-white/10"
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="내용을 입력해 주세요"
                className="h-[360px] w-full resize-none rounded-xl bg-white/5 p-4 text-sm leading-relaxed text-white/90 ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={onSubmit}
                  disabled={submitting}
                  className="rounded-xl bg-white/10 px-5 py-2 text-sm text-white/80 ring-1 ring-white/10 transition hover:bg-white/15 disabled:opacity-50"
                >
                  {submitting ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
