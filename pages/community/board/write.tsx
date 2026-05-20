// pages/community/write.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { supabase } from "@/lib/supabaseClient"; // createBrowserClient 기반
import { getImage } from "@/lib/getUrl";
import LoginRequiredModal from "@/components/LoginRequiredModal";

const POST_IMAGES_BUCKET = "post-images"; // 실제 버킷명으로 변경
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 50;
const WRITE_PAGE_IMAGE_SRC = getImage("assets", "write_page_image.png");

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

function formatClock(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

function formatCalendarDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export default function WritePage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const [title, setTitle] = useState("");
  const [isSecret, setIsSecret] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [, setEditorStateVersion] = useState(0);
  const nextUrl = useMemo(() => "/community/board/write", []);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        listItem: false,
        orderedList: false,
        strike: false,
      }),
      Underline,
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "min-h-[360px] border-b border-white/12 bg-transparent px-1 py-4 text-sm leading-relaxed text-white/90 focus:outline-none focus:border-white/30",
      },
    },
    onSelectionUpdate: () => setEditorStateVersion((v) => v + 1),
    onUpdate: () => setEditorStateVersion((v) => v + 1),
    immediatelyRender: false,
  });

  const toolbarButtonClass = (active: boolean, extra = "") =>
    [
      "inline-flex h-9 w-9 items-center justify-center border-b text-sm transition",
      active
        ? "border-white text-white"
        : "border-transparent text-white/55 hover:border-white/25 hover:text-white",
      extra,
    ].join(" ");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const { data } = await supabase.auth.getUser();
      const u = data.user;

      if (cancelled) return;

      if (!u) {
        setReady(true);
        setLoginModalOpen(true);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  function validateImageFile(file: File) {
    const sizeMb = file.size / (1024 * 1024);

    if (sizeMb > MAX_FILE_SIZE_MB) {
      alert(`파일이 너무 큽니다: ${file.name} (${formatBytes(file.size)})`);
      return false;
    }

    if (!file.type.startsWith("image/")) {
      alert(`이미지 파일만 첨부할 수 있어요: ${file.name}`);
      return false;
    }

    return true;
  }

  function addFiles(nextFiles: File[]) {
    const validFiles = nextFiles.filter(validateImageFile);
    if (validFiles.length === 0) return;

    setFiles((prev) => {
      const availableSlots = MAX_FILES - prev.length;
      if (availableSlots <= 0) {
        alert(`이미지는 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
        return prev;
      }

      if (validFiles.length > availableSlots) {
        alert(`이미지는 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      }

      return [...prev, ...validFiles.slice(0, availableSlots)];
    });
  }

  function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (!list) return;

    addFiles(Array.from(list));
    e.target.value = "";
  }

  function onDropFiles(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDraggingFiles(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
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
    const editorText = editor?.getText().trim() ?? "";
    const editorHtml = editor?.getHTML() ?? "";

    if (!trimmedTitle) {
      alert("제목을 입력해 주세요.");
      return;
    }

    if (!editorText) {
      alert("내용을 입력해 주세요.");
      return;
    }

    if (!userId) {
      setLoginModalOpen(true);
      return;
    }

    if (files.length > MAX_FILES) {
      alert(`이미지는 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    setSubmitting(true);

    // 1) posts insert → postId 확보
    const { data: inserted, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: userId,
        title: trimmedTitle,
        content: editorHtml,
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
    } catch {
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
        <div className="min-h-screen bg-[#0a0a0a]" />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Calmato | 글 남기기</title>
      </Head>

      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => {
          setLoginModalOpen(false);
          void router.push("/community/board");
        }}
        nextPath={nextUrl}
        exploreHref="/community/board"
      />

      <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a]">
        {/* 오른쪽 배경 이미지 */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[100vw] bg-cover bg-right-center opacity-85 lg:block"
          style={{ backgroundImage: `url(${WRITE_PAGE_IMAGE_SRC})` }}
          aria-hidden="true"
        />

        {/* 이미지 왼쪽 페이드 */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[100vw] lg:block"
          style={{
            background:
              "linear-gradient(to right, #0a0a0a 0%, rgba(10,10,10,0.92) 25%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.18) 70%, rgba(10,10,10,0) 100%)",
          }}
        />

        {/* 전체 상하 어둡게 */}
        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#0a0a0a]/55 via-transparent to-[#0a0a0a] lg:block" />
        <div className="relative z-10 grid min-h-screen gap-10 px-8 pt-8 pb-16 sm:pl-12 md:pl-16 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_520px]">
          <div className="max-w-4xl border border-white/12 p-8 rounded-md self-start bg-[#0a0a0a]/18 backdrop-blur-[1px]">
            <div className="mb-6 border-b border-white/12 pb-4 text-xl font-semibold text-white/90">글 남기기</div>

            {/* Title */}
            <div className="mb-4">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="제목을 입력해 주세요"
                className="h-12 w-full border-b border-white/12 bg-transparent px-1 text-sm text-white/90 placeholder:text-white/35 focus:border-white/30 focus:outline-none"
              />
            </div>

            {/* Toolbar */}
            <div className="mb-2 flex items-center justify-between border-b border-white/12 py-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                  disabled={!editor}
                  aria-pressed={editor?.isActive("bold") ?? false}
                  className={toolbarButtonClass(
                    editor?.isActive("bold") ?? false,
                    "font-bold"
                  )}
                  title="굵게"
                >
                  B
                </button>

                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                  disabled={!editor}
                  aria-pressed={editor?.isActive("italic") ?? false}
                  className={toolbarButtonClass(
                    editor?.isActive("italic") ?? false,
                    "italic"
                  )}
                  title="기울임"
                >
                  I
                </button>

                <button
                  type="button"
                  onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  disabled={!editor}
                  aria-pressed={editor?.isActive("underline") ?? false}
                  className={toolbarButtonClass(
                    editor?.isActive("underline") ?? false,
                    "underline underline-offset-2"
                  )}
                  title="밑줄"
                >
                  U
                </button>

                <div className="mx-1 h-5 w-px bg-white/10" />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-9 w-9 items-center justify-center border-b border-transparent text-white/55 transition hover:border-white/25 hover:text-white"
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
            <div
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDraggingFiles(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                setIsDraggingFiles(false);
              }}
              onDrop={onDropFiles}
              className={`mb-4 rounded-xl border border-dashed p-3 transition ${
                isDraggingFiles
                  ? "border-white/35 bg-white/5"
                  : "border-white/12 bg-transparent"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3 text-xs text-white/55">
                <span>첨부된 사진</span>
                <span>{files.length}/{MAX_FILES}</span>
              </div>

              {files.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {files.map((f, idx) => (
                    <div
                      key={`${f.name}_${idx}`}
                      className="flex items-center justify-between border-b border-white/8 px-1 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm text-white/80">{f.name}</div>
                        <div className="text-xs text-white/45">{formatBytes(f.size)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="border-b border-transparent px-1 py-2 text-xs text-white/55 transition hover:border-white/25 hover:text-white/80"
                      >
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-20 w-full items-center justify-center border-y border-white/8 text-sm text-white/45 transition hover:border-white/18 hover:text-white/65"
                >
                  사진을 드래그 하거나 영역을 클릭해 파일을 선택하세요.
                </button>
              )}
            </div>

            {/* Content */}
            <div className="relative">
              <EditorContent editor={editor} />
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

          <aside className="hidden min-h-[calc(100vh-10rem)] lg:flex lg:flex-col lg:justify-between lg:p-10 text-white/75">
              <div className="pt-0">
                <p className="max-w-[260px] text-lg leading-8 text-white/68">
                  당신의 오늘 하루는 어땠나요?
                </p>
                <div className="mt-8 h-px w-10 bg-white/24" />
              </div>

              <div className="pb-0">
                <div className="h-px w-10 bg-white/24" />
                <div className="mt-8 text-4xl font-semibold tracking-wide text-white/76">
                  {formatClock(now)}
                </div>
                <div className="mt-3 text-base text-white/52">
                  {formatCalendarDate(now)}
                </div>
              </div>
          </aside>
        </div>
      </div>
    </>
  );
}
