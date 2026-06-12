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

type ExistingImage = {
  storagePath: string;
  sortOrder: number | null;
  url: string;
};

type EditPostRow = {
  id: number;
  user_id: string;
  title: string | null;
  content: string | null;
  is_secret: boolean | null;
  card_background_type: string | null;
  card_background_value: string | null;
  post_images: { storage_path: string | null; sort_order: number | null }[] | null;
};

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

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitStoragePath(path: string) {
  const idx = path.lastIndexOf("/");

  if (idx === -1) {
    return { folder: "", name: path };
  }

  return {
    folder: path.slice(0, idx),
    name: path.slice(idx + 1),
  };
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

function getExistingBackgroundId(path: string) {
  return `existing:${path}`;
}

function getUploadBackgroundId(idx: number) {
  return `upload:${idx}`;
}

function isPostBackgroundKind(value: string | null): value is "color" | "uploaded" | "asset" {
  return value === "color" || value === "uploaded" || value === "asset";
}

export default function WritePage() {
  const router = useRouter();
  const editPostId = useMemo(() => {
    if (!router.isReady) return null;

    const raw = router.query.edit;
    const value = Array.isArray(raw) ? raw[0] : raw;
    const id = Number(value);

    return Number.isInteger(id) && id > 0 ? id : null;
  }, [router.isReady, router.query.edit]);
  const isEditMode = editPostId !== null;

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [viewerNickname, setViewerNickname] = useState("Unknown");
  const [viewerProfileImagePath, setViewerProfileImagePath] = useState<string | null>(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const [title, setTitle] = useState("");
  const [isSecret, setIsSecret] = useState(false);

  const [editLoaded, setEditLoaded] = useState(false);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [removedExistingPaths, setRemovedExistingPaths] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<{ file: File; url: string }[]>([]);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [selectedBackground, setSelectedBackground] =
    useState<PostBackgroundSelection>(EMPTY_BACKGROUND_SELECTION);

  const [submitting, setSubmitting] = useState(false);
  const [, setEditorStateVersion] = useState(0);
  const nextUrl = useMemo(
    () => (editPostId ? `/community/board/write?edit=${editPostId}` : "/community/board/write"),
    [editPostId]
  );
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
    if (!router.isReady || !isEditMode || !editPostId || !userId || !editor) return;

    let cancelled = false;
    const editorInstance = editor;

    async function loadPostForEdit() {
      setEditLoaded(false);

      const { data, error } = await supabase
        .from("posts")
        .select(
          `
            id,
            user_id,
            title,
            content,
            is_secret,
            card_background_type,
            card_background_value,
            post_images(storage_path, sort_order)
          `
        )
        .eq("id", editPostId)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        alert("수정할 게시글을 불러오지 못했습니다.");
        void router.replace("/community/board");
        return;
      }

      const post = data as EditPostRow;

      if (post.user_id !== userId) {
        alert("본인 게시글만 수정할 수 있습니다.");
        void router.replace(`/community/board/${editPostId}`);
        return;
      }

      const images = (post.post_images ?? [])
        .filter((image): image is { storage_path: string; sort_order: number | null } =>
          Boolean(image.storage_path)
        )
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((image) => {
          const {
            data: { publicUrl },
          } = supabase.storage.from(POST_IMAGES_BUCKET).getPublicUrl(image.storage_path);

          return {
            storagePath: image.storage_path,
            sortOrder: image.sort_order,
            url: publicUrl,
          };
        });

      setTitle(post.title ?? "");
      setIsSecret(Boolean(post.is_secret));
      setExistingImages(images);
      setRemovedExistingPaths([]);
      setFiles([]);
      editorInstance.commands.setContent(post.content ?? "");

      if (isPostBackgroundKind(post.card_background_type)) {
        const nextSelection: PostBackgroundSelection =
          post.card_background_type === "uploaded" && post.card_background_value
            ? {
                type: "uploaded",
                value: getExistingBackgroundId(post.card_background_value),
              }
            : {
                type: post.card_background_type,
                value: post.card_background_value,
              };

        setSelectedBackground(nextSelection);
      } else {
        setSelectedBackground(EMPTY_BACKGROUND_SELECTION);
      }

      setEditLoaded(true);
    }

    void loadPostForEdit();

    return () => {
      cancelled = true;
    };
  }, [editPostId, editor, isEditMode, router, router.isReady, userId]);

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
    () => [
      ...existingImages.map((image, idx) => ({
        id: getExistingBackgroundId(image.storagePath),
        label: `기존 이미지 ${idx + 1}`,
        url: image.url,
      })),
      ...filePreviews.map((preview, idx) => ({
        id: getUploadBackgroundId(idx),
        label: preview.file.name,
        url: preview.url,
      })),
    ],
    [existingImages, filePreviews]
  );

  const attachmentPreviewItems = useMemo(
    () => [
      ...existingImages.map((image, idx) => ({
        id: getExistingBackgroundId(image.storagePath),
        type: "existing" as const,
        label: `기존 이미지 ${idx + 1}`,
        url: image.url,
        index: idx,
      })),
      ...filePreviews.map((preview, idx) => ({
        id: getUploadBackgroundId(idx),
        type: "new" as const,
        label: preview.file.name,
        url: preview.url,
        index: idx,
      })),
    ],
    [existingImages, filePreviews]
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
      const availableSlots = MAX_FILES - existingImages.length - prev.length;
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

  function removeExistingImage(idx: number) {
    const image = existingImages[idx];
    if (!image) return;

    setExistingImages((prev) => prev.filter((_, i) => i !== idx));
    setRemovedExistingPaths((prev) =>
      prev.includes(image.storagePath) ? prev : [...prev, image.storagePath]
    );
  }

  async function findMissingUploadedPaths(paths: string[]) {
    const byFolder = new Map<string, Set<string>>();

    for (const path of paths) {
      const { folder, name } = splitStoragePath(path);
      const names = byFolder.get(folder) ?? new Set<string>();
      names.add(name);
      byFolder.set(folder, names);
    }

    const missing: string[] = [];

    for (const [folder, expectedNames] of byFolder) {
      const { data, error } = await supabase.storage
        .from(POST_IMAGES_BUCKET)
        .list(folder, { limit: 1000 });

      if (error) throw error;

      const existingNames = new Set((data ?? []).map((object) => object.name));

      for (const name of expectedNames) {
        if (!existingNames.has(name)) {
          missing.push(folder ? `${folder}/${name}` : name);
        }
      }
    }

    return missing;
  }

  async function verifyUploadedImages(paths: string[]) {
    if (paths.length === 0) return;

    let missing = paths;

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      missing = await findMissingUploadedPaths(paths);

      if (missing.length === 0) return;

      if (attempt < 3) {
        await wait(250 * attempt);
      }
    }

    throw new Error(`이미지 업로드 확인 실패: ${missing.join(", ")}`);
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

      await verifyUploadedImages(uploadedPaths);

      return uploadedPaths;
    } catch (err) {
      // best-effort cleanup
      if (uploadedPaths.length > 0) {
        await supabase.storage.from(POST_IMAGES_BUCKET).remove(uploadedPaths);
      }
      throw err;
    }
  }

  async function insertPostImages(postId: number, paths: string[], startOrder = 0) {
    if (paths.length === 0) return;

    const rows = paths.map((p, idx) => ({
      post_id: postId,
      storage_path: p,
      sort_order: startOrder + idx,
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
    if (selection.type !== "uploaded" || !selection.value?.startsWith("upload:")) return null;

    const idx = Number(selection.value.replace("upload:", ""));
    return Number.isInteger(idx) && idx >= 0 ? idx : null;
  }

  function getExistingBackgroundPath(selection: PostBackgroundSelection) {
    if (selection.type !== "uploaded" || !selection.value?.startsWith("existing:")) return null;
    return selection.value.replace("existing:", "");
  }

  function getBackgroundPayload(
    selection: PostBackgroundSelection,
    uploadedPaths: string[]
  ) {
    if (selection.type === "color" || selection.type === "asset") {
      return {
        card_background_type: selection.type,
        card_background_value: selection.value,
      };
    }

    if (selection.type === "uploaded") {
      const existingPath = getExistingBackgroundPath(selection);
      if (existingPath) {
        return {
          card_background_type: "uploaded",
          card_background_value: existingPath,
        };
      }

      const idx = getUploadedBackgroundIndex(selection);
      const selectedPath = idx === null ? null : uploadedPaths[idx] ?? null;

      if (selectedPath) {
        return {
          card_background_type: "uploaded",
          card_background_value: selectedPath,
        };
      }
    }

    return {
      card_background_type: null,
      card_background_value: null,
    };
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

    if (existingImages.length + files.length > MAX_FILES) {
      alert(`이미지는 최대 ${MAX_FILES}개까지 첨부할 수 있어요.`);
      return;
    }

    setSubmitting(true);

    let uploadedPaths: string[] = [];

    if (isEditMode && editPostId) {
      try {
        if (files.length > 0) {
          uploadedPaths = await uploadImages(editPostId, files);
        }

        if (uploadedPaths.length > 0) {
          await insertPostImages(editPostId, uploadedPaths, existingImages.length);
        }

        const sortUpdateResults = await Promise.all(
          existingImages.map((image, idx) =>
            supabase
              .from("post_images")
              .update({ sort_order: idx })
              .eq("post_id", editPostId)
              .eq("storage_path", image.storagePath)
          )
        );
        const sortUpdateError = sortUpdateResults.find((result) => result.error)?.error;
        if (sortUpdateError) throw sortUpdateError;

        const { error: updateError } = await supabase
          .from("posts")
          .update({
            title: trimmedTitle,
            content: editorHtml,
            is_secret: isSecret,
            ...getBackgroundPayload(selectedBackground, uploadedPaths),
          })
          .eq("id", editPostId)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        if (removedExistingPaths.length > 0) {
          const { error: imageDeleteError } = await supabase
            .from("post_images")
            .delete()
            .eq("post_id", editPostId)
            .in("storage_path", removedExistingPaths);

          if (imageDeleteError) throw imageDeleteError;

          await supabase.storage.from(POST_IMAGES_BUCKET).remove(removedExistingPaths);
        }

        await router.push(`/community/board/${editPostId}`);
      } catch (error) {
        console.error(error);

        if (uploadedPaths.length > 0) {
          await supabase
            .from("post_images")
            .delete()
            .eq("post_id", editPostId)
            .in("storage_path", uploadedPaths);
          await supabase.storage.from(POST_IMAGES_BUCKET).remove(uploadedPaths);
        }

        setSubmitting(false);
        alert("게시글 수정 중 오류가 발생했습니다.");
      }

      return;
    }

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

    if (insertError || !inserted?.id) {
      setSubmitting(false);
      alert(`posts insert 실패: ${insertError?.message ?? "unknown"}`);
      return;
    }

    const postId = inserted.id as number;

    try {
      if (files.length > 0) {
        uploadedPaths = await uploadImages(postId, files);
      }

      if (uploadedPaths.length > 0) {
        await insertPostImages(postId, uploadedPaths);
      }

      await updateUploadedPostBackground(postId, selectedBackground, uploadedPaths);

      router.push("/community/board");
    } catch {
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

  if (!ready || (Boolean(userId) && isEditMode && !editLoaded)) {
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
            <div className="mb-6 border-b border-white/12 pb-4 text-2xl font-semibold text-white/90">
              {isEditMode ? "글 수정하기" : "글 남기기"}
            </div>

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
                  <span>{existingImages.length + files.length}/{MAX_FILES}</span>
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
                {attachmentPreviewItems.length > 0 ? (
                  <div className="flex min-h-16 items-center gap-2 overflow-x-auto">
                    {attachmentPreviewItems.map((preview) => (
                      <div
                        key={preview.id}
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
                            if (preview.type === "existing") {
                              removeExistingImage(preview.index);
                              return;
                            }

                            removeFile(preview.index);
                          }}
                          className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-xs text-white/70 opacity-90 transition hover:bg-black/75 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label={`${preview.label} 삭제`}
                        >
                          ×
                        </button>
                      </div>
                    ))}

                    {existingImages.length + files.length < MAX_FILES && (
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
                  {submitting ? (isEditMode ? "수정 중..." : "등록 중...") : isEditMode ? "수정" : "등록"}
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
