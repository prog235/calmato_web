// pages/community/write.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { Palette } from "lucide-react";
import { supabase } from "@/lib/supabaseClient"; // createBrowserClient 기반
import { getImage } from "@/lib/getUrl";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import PostBackgroundPicker, {
  type PostBackgroundSelection,
} from "@/components/PostBackgroundPicker";

const POST_IMAGES_BUCKET = "post-images"; // 실제 버킷명으로 변경
const MAX_FILES = 10;
const MAX_FILE_SIZE_MB = 50;
const WRITE_PAGE_IMAGE_SRC = getImage("assets", "write_page_image.png");
const EMPTY_BACKGROUND_SELECTION: PostBackgroundSelection = { type: "none", value: null };

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
  const [viewerNickname, setViewerNickname] = useState("Unknown");
  const [viewerProfileImagePath, setViewerProfileImagePath] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const [title, setTitle] = useState("");
  const [isSecret, setIsSecret] = useState(false);

  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string }[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<PostBackgroundSelection>(EMPTY_BACKGROUND_SELECTION);

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
          "h-[360px] overflow-y-auto border-b border-white/12 bg-transparent px-1 py-4 text-sm leading-relaxed text-white/90 focus:outline-none focus:border-white/30",
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname, profile_image_path")
        .eq("id", u.id)
        .maybeSingle();

      if (!cancelled) {
        setViewerNickname(profile?.nickname ?? "Unknown");
        setViewerProfileImagePath(profile?.profile_image_path ?? null);
      }

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

  useEffect(() => {
    const previews = files.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));

    setFilePreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [files]);

  const uploadedBackgroundOptions = useMemo(
    () =>
      filePreviews.map((preview, idx) => ({
        id: `upload:${idx}`,
        label: preview.file.name,
        url: preview.url,
      })),
    [filePreviews]
  );

  useEffect(() => {
    if (uploadedBackgroundOptions.length > 0 && selectedBackground.type === "none") {
      setSelectedBackground({
        type: "uploaded",
        value: uploadedBackgroundOptions[0].id,
      });
      return;
    }

    if (selectedBackground.type === "uploaded") {
      const exists = uploadedBackgroundOptions.some(
        (option) => option.id === selectedBackground.value
      );

      if (!exists) {
        setSelectedBackground(
          uploadedBackgroundOptions.length > 0
            ? {
                type: "uploaded",
                value: uploadedBackgroundOptions[0].id,
              }
            : EMPTY_BACKGROUND_SELECTION
        );
      }
    }
  }, [selectedBackground, uploadedBackgroundOptions]);

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

  function getInitialBackgroundPayload(selection: PostBackgroundSelection) {
    if (selection.type === "color" || selection.type === "asset") {
      return {
        card_background_type: selection.type,
        card_background_value: selection.value,
      };
    }

    return {
      card_background_type: null,
      card_background_value: null,
    };
  }

  function getUploadedBackgroundIndex(selection: PostBackgroundSelection) {
    if (selection.type !== "uploaded" || !selection.value) return null;

    const idx = Number(selection.value.replace("upload:", ""));
    return Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  async function updateUploadedPostBackground(
    postId: number,
    selection: PostBackgroundSelection,
    uploadedPaths: string[]
  ) {
    const idx = getUploadedBackgroundIndex(selection);
    if (idx === null) return;

    const selectedPath = uploadedPaths[idx];
    if (!selectedPath) return;

    const { error } = await supabase
      .from("posts")
      .update({
        card_background_type: "uploaded",
        card_background_value: selectedPath,
      })
      .eq("id", postId);

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
        ...getInitialBackgroundPayload(selectedBackground),
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

      await updateUploadedPostBackground(postId, selectedBackground, uploadedPaths);

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
        {/* 왼쪽 배경 이미지 */}
        <div
          className="pointer-events-none absolute inset-y-0 left-0 hidden w-[100vw] origin-center bg-cover bg-center opacity-85 lg:block"
          style={{
            backgroundImage: `url(${WRITE_PAGE_IMAGE_SRC})`,
            transform: "scaleX(-1)",
          }}
          aria-hidden="true"
        />

        {/* 이미지 오른쪽 페이드 */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 hidden w-[100vw] lg:block"
          style={{
            background:
              "linear-gradient(to left, #0a0a0a 0%, rgba(10,10,10,0.92) 25%, rgba(10,10,10,0.55) 50%, rgba(10,10,10,0.18) 70%, rgba(10,10,10,0) 100%)",
          }}
        />

        {/* 전체 상하 어둡게 */}
        <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-[#0a0a0a]/30 via-transparent to-[#0a0a0a]/30 lg:block" />
        <div className="relative z-10 grid min-h-screen gap-10 pt-8 pb-16 sm:px-8 md:px-12 lg:px-16 lg:grid-cols-[420px_minmax(0,1fr)] xl:grid-cols-[520px_minmax(0,1fr)]">
          <aside className="hidden min-h-[calc(100vh-10rem)] lg:flex lg:flex-col lg:justify-between lg:p-4 text-white/75">
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

          <div className="w-full max-w-4xl justify-self-end border border-white/12 p-8 rounded-md self-start bg-[#0a0a0a]/18 backdrop-blur-[1px]">
            <div className="mb-6 border-b border-white/12 pb-4 text-2xl font-semibold text-white/90">글 남기기</div>

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
            <div className="mb-4 flex items-center justify-between border-b border-white/12 py-2">
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
                  className="inline-flex h-9 items-center gap-1.5 border-b border-transparent px-1 text-xs text-white/55 transition hover:border-white/25 hover:text-white/80"
                  title="사진 첨부"
                >
                  <span>사진</span>
                  <span className="text-white/30" aria-hidden="true">·</span>
                  <span>{files.length}/{MAX_FILES}</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={onPickFiles}
                  className="hidden"
                />
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

            {/* Photo attachments */}
            <div
              className="mb-4 pb-4"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
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
                className={`rounded-xl border border-dashed px-4 py-3 transition ${
                  isDraggingFiles
                    ? "border-white/30 bg-white/[0.045]"
                    : "border-white/10 bg-white/[0.015] hover:border-white/18 hover:bg-white/[0.025]"
                }`}
              >
                {files.length > 0 ? (
                  <div className="flex min-h-16 items-center gap-2 overflow-x-auto">
                    {filePreviews.map((preview, idx) => (
                      <div
                        key={`${preview.file.name}_${idx}`}
                        className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-white/10 bg-white/[0.035]"
                      >
                        <img
                          src={preview.url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(idx);
                          }}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-xs text-white/70 opacity-90 transition hover:bg-black/75 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`${preview.file.name} 삭제`}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {files.length < MAX_FILES && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-white/12 bg-white/[0.015] text-xs text-white/45 transition hover:border-white/24 hover:text-white/70"
                      >
                        + 추가
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className="flex min-h-16 w-full flex-col items-center justify-center gap-1 text-sm text-white/42 transition"
                  >
                    <span>
                      {isDraggingFiles
                        ? "여기에 사진을 놓아주세요."
                        : "사진을 드래그 하거나 클릭해서 추가하세요."}
                    </span>
                    <span className="text-xs text-white/32">
                      최대 {MAX_FILE_SIZE_MB}MB
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="relative">
              <EditorContent editor={editor} placeholder="오늘의 하루는 어땠나요?"/>
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBackgroundPickerOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/[0.035] px-4 py-2 text-sm text-white/68 ring-1 ring-white/10 transition hover:bg-white/10 hover:text-white/85"
                  aria-expanded={backgroundPickerOpen}
                >
                  <Palette size={15} aria-hidden="true" />
                  배경 설정
                </button>
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

      <PostBackgroundPicker
        open={backgroundPickerOpen}
        selection={selectedBackground}
        uploadedImages={uploadedBackgroundOptions}
        title={title}
        content={editor?.getHTML() ?? ""}
        nickname={viewerNickname}
        profileImagePath={viewerProfileImagePath}
        onClose={() => setBackgroundPickerOpen(false)}
        onConfirm={(selection) => {
          setSelectedBackground(selection);
          setBackgroundPickerOpen(false);
        }}
      />
    </>
  );
}
