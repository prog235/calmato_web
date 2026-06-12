import type { GetServerSideProps } from "next";
import Head from "next/head";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  Disc3,
  FileAudio,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

const TRACK_AUDIO_BUCKET = "audio";
const TRACK_THUMBNAIL_BUCKET = "thumbnails";
const TRACK_ADMIN_MEMO =
  "썸네일 파일 명, 오디오 파일 명은 공백 없이 영어로 작성해야함! (ex. Calmato_sparkle.jpg) 모르는 거 있으면 이상호에게 물어볼 것. 수정 시에는 그냥 새 이미지나 파일 넣고 저장 누르면 됨 (파일 경로 수정 필요 x)";

type ArchiveCategory = {
  id: number;
  name: string;
};

type AdminTracksPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
  categories: ArchiveCategory[];
};

type TrackFormState = {
  title: string;
  subtitle: string;
  categoryId: string;
  thumbnailPath: string;
  audioPath: string;
  youtubeUrl: string;
  descKim: string;
  descLee: string;
};

type TrackRow = {
  id: number;
  title: string;
  subtitle: string | null;
  thumbnail_path: string | null;
  audio_path: string | null;
  youtube_url: string | null;
  desc_kim: string | null;
  desc_lee: string | null;
  category_id: number | null;
};

const initialForm: TrackFormState = {
  title: "",
  subtitle: "",
  categoryId: "",
  thumbnailPath: "",
  audioPath: "",
  youtubeUrl: "",
  descKim: "",
  descLee: "",
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function makeStoragePath(kind: "audio" | "thumbnail", categoryId: string, file: File) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return `tracks/category-${categoryId}/${kind}-${uuid}_${safeFileName(file.name)}`;
}

function normalizeText(value: string) {
  return value.trim();
}

export default function AdminTracksPage({
  admin,
  categories,
}: AdminTracksPageProps) {
  const [form, setForm] = useState<TrackFormState>(() => ({
    ...initialForm,
    categoryId: categories[0]?.id ? String(categories[0].id) : "",
  }));
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string>("");
  const [editForm, setEditForm] = useState<TrackFormState>(() => ({
    ...initialForm,
    categoryId: categories[0]?.id ? String(categories[0].id) : "",
  }));
  const [editThumbnailFile, setEditThumbnailFile] = useState<File | null>(null);
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editDeleting, setEditDeleting] = useState(false);
  const [editMessage, setEditMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<"thumbnail" | "audio" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.categoryId.trim().length > 0 &&
      (form.audioPath.trim().length > 0 || audioFile !== null) &&
      !submitting
    );
  }, [audioFile, form.audioPath, form.categoryId, form.title, submitting]);

  const selectedTrack = useMemo(() => {
    return tracks.find((track) => String(track.id) === selectedTrackId) ?? null;
  }, [selectedTrackId, tracks]);

  const canUpdate = useMemo(() => {
    return (
      selectedTrack !== null &&
      editForm.title.trim().length > 0 &&
      editForm.categoryId.trim().length > 0 &&
      (editForm.audioPath.trim().length > 0 || editAudioFile !== null) &&
      !editSubmitting &&
      !editDeleting
    );
  }, [
    editAudioFile,
    editDeleting,
    editForm.audioPath,
    editForm.categoryId,
    editForm.title,
    editSubmitting,
    selectedTrack,
  ]);

  useEffect(() => {
    void loadTracks();
  }, []);

  function updateField<K extends keyof TrackFormState>(
    key: K,
    value: TrackFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateEditField<K extends keyof TrackFormState>(
    key: K,
    value: TrackFormState[K]
  ) {
    setEditForm((prev) => ({ ...prev, [key]: value }));
  }

  function trackToForm(track: TrackRow): TrackFormState {
    return {
      title: track.title ?? "",
      subtitle: track.subtitle ?? "",
      categoryId: track.category_id ? String(track.category_id) : "",
      thumbnailPath: track.thumbnail_path ?? "",
      audioPath: track.audio_path ?? "",
      youtubeUrl: track.youtube_url ?? "",
      descKim: track.desc_kim ?? "",
      descLee: track.desc_lee ?? "",
    };
  }

  async function loadTracks() {
    setTracksLoading(true);
    setTracksError(null);

    const { data, error } = await supabase
      .from("tracks")
      .select(
        "id, title, subtitle, thumbnail_path, audio_path, youtube_url, desc_kim, desc_lee, category_id"
      )
      .order("id", { ascending: true });

    if (error) {
      setTracks([]);
      setTracksError(error.message);
      setTracksLoading(false);
      return;
    }

    const rows = (data ?? []) as TrackRow[];
    setTracks(rows);
    setTracksLoading(false);

    if (selectedTrackId && !rows.some((track) => String(track.id) === selectedTrackId)) {
      setSelectedTrackId("");
      setEditForm({
        ...initialForm,
        categoryId: categories[0]?.id ? String(categories[0].id) : "",
      });
      setEditThumbnailFile(null);
      setEditAudioFile(null);
    }
  }

  function onSelectTrack(trackId: string) {
    setSelectedTrackId(trackId);
    setEditMessage(null);
    setEditThumbnailFile(null);
    setEditAudioFile(null);

    const track = tracks.find((item) => String(item.id) === trackId);
    if (track) setEditForm(trackToForm(track));
  }

  function onFileChange(
    e: ChangeEvent<HTMLInputElement>,
    kind: "thumbnail" | "audio",
    setter: (file: File | null) => void
  ) {
    const file = e.target.files?.[0] ?? null;
    if (file) setAcceptedFile(kind, file, setter);
    else setter(null);
  }

  function setAcceptedFile(
    kind: "thumbnail" | "audio",
    file: File,
    setter: (file: File | null) => void
  ) {
    const valid =
      kind === "thumbnail"
        ? file.type.startsWith("image/")
        : file.type.startsWith("audio/");

    if (!valid) {
      setMessage({
        type: "error",
        text:
          kind === "thumbnail"
            ? "썸네일에는 이미지 파일만 드롭할 수 있습니다."
            : "오디오에는 오디오 파일만 드롭할 수 있습니다.",
      });
      return;
    }

    setMessage(null);
    setter(file);
  }

  function onDropFile(
    e: DragEvent<HTMLLabelElement>,
    kind: "thumbnail" | "audio",
    setter: (file: File | null) => void
  ) {
    e.preventDefault();
    setDragTarget(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setAcceptedFile(kind, file, setter);
  }

  async function uploadFile(bucket: string, path: string, file: File) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

    if (error) throw error;
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage({
        type: "error",
        text: "제목, 카테고리, 오디오 파일 또는 오디오 경로를 확인해주세요.",
      });
      return;
    }

    const uploaded: { bucket: string; path: string }[] = [];
    setSubmitting(true);

    try {
      let thumbnailPath = form.thumbnailPath.trim();
      let audioPath = form.audioPath.trim();

      if (thumbnailFile) {
        thumbnailPath = makeStoragePath("thumbnail", form.categoryId, thumbnailFile);
        await uploadFile(TRACK_THUMBNAIL_BUCKET, thumbnailPath, thumbnailFile);
        uploaded.push({ bucket: TRACK_THUMBNAIL_BUCKET, path: thumbnailPath });
      }

      if (audioFile) {
        audioPath = makeStoragePath("audio", form.categoryId, audioFile);
        await uploadFile(TRACK_AUDIO_BUCKET, audioPath, audioFile);
        uploaded.push({ bucket: TRACK_AUDIO_BUCKET, path: audioPath });
      }

      const { data, error } = await supabase
        .from("tracks")
        .insert({
          title: form.title.trim(),
          subtitle: normalizeText(form.subtitle),
          thumbnail_path: normalizeText(thumbnailPath),
          audio_path: audioPath,
          youtube_url: normalizeText(form.youtubeUrl),
          desc_kim: normalizeText(form.descKim),
          desc_lee: normalizeText(form.descLee),
          category_id: Number(form.categoryId),
        })
        .select("id")
        .single();

      if (error) throw error;

      setForm({
        ...initialForm,
        categoryId: form.categoryId,
      });
      setThumbnailFile(null);
      setAudioFile(null);
      setMessage({
        type: "success",
        text: `트랙이 추가되었습니다. ID: ${data.id}`,
      });
      await loadTracks();
    } catch (err) {
      await Promise.all(
        uploaded.map((item) =>
          supabase.storage.from(item.bucket).remove([item.path])
        )
      );

      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "트랙 추가 중 오류가 발생했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function onUpdateTrack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setEditMessage(null);

    if (!selectedTrack || !canUpdate) {
      setEditMessage({
        type: "error",
        text: "수정할 트랙과 필수 입력값을 확인해주세요.",
      });
      return;
    }

    const uploaded: { bucket: string; path: string }[] = [];
    setEditSubmitting(true);

    try {
      let thumbnailPath = editForm.thumbnailPath.trim();
      let audioPath = editForm.audioPath.trim();

      if (editThumbnailFile) {
        thumbnailPath = makeStoragePath("thumbnail", editForm.categoryId, editThumbnailFile);
        await uploadFile(TRACK_THUMBNAIL_BUCKET, thumbnailPath, editThumbnailFile);
        uploaded.push({ bucket: TRACK_THUMBNAIL_BUCKET, path: thumbnailPath });
      }

      if (editAudioFile) {
        audioPath = makeStoragePath("audio", editForm.categoryId, editAudioFile);
        await uploadFile(TRACK_AUDIO_BUCKET, audioPath, editAudioFile);
        uploaded.push({ bucket: TRACK_AUDIO_BUCKET, path: audioPath });
      }

      const { error } = await supabase
        .from("tracks")
        .update({
          title: editForm.title.trim(),
          subtitle: normalizeText(editForm.subtitle),
          thumbnail_path: normalizeText(thumbnailPath),
          audio_path: audioPath,
          youtube_url: normalizeText(editForm.youtubeUrl),
          desc_kim: normalizeText(editForm.descKim),
          desc_lee: normalizeText(editForm.descLee),
          category_id: Number(editForm.categoryId),
        })
        .eq("id", selectedTrack.id);

      if (error) throw error;

      setEditThumbnailFile(null);
      setEditAudioFile(null);
      setEditMessage({
        type: "success",
        text: "트랙이 수정되었습니다.",
      });
      await loadTracks();
      setEditForm({
        ...editForm,
        thumbnailPath,
        audioPath,
      });
    } catch (err) {
      await Promise.all(
        uploaded.map((item) =>
          supabase.storage.from(item.bucket).remove([item.path])
        )
      );

      setEditMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "트랙 수정 중 오류가 발생했습니다.",
      });
    } finally {
      setEditSubmitting(false);
    }
  }

  async function onDeleteTrack() {
    if (!selectedTrack) return;

    const confirmed = window.confirm(
      `"${selectedTrack.title}" 트랙을 삭제할까요? 연결된 플레이리스트가 있으면 삭제가 실패할 수 있습니다.`
    );

    if (!confirmed) return;

    setEditDeleting(true);
    setEditMessage(null);

    try {
      const { error } = await supabase
        .from("tracks")
        .delete()
        .eq("id", selectedTrack.id);

      if (error) throw error;

      setSelectedTrackId("");
      setEditForm({
        ...initialForm,
        categoryId: categories[0]?.id ? String(categories[0].id) : "",
      });
      setEditThumbnailFile(null);
      setEditAudioFile(null);
      setEditMessage({
        type: "success",
        text: "트랙이 삭제되었습니다.",
      });
      await loadTracks();
    } catch (err) {
      setEditMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "트랙 삭제 중 오류가 발생했습니다.",
      });
    } finally {
      setEditDeleting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Track Admin | Calmato</title>
      </Head>

      <main className="min-h-screen bg-[#0a0a0a] px-5 pb-20 pt-28 text-white md:px-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <header className="flex flex-col gap-5 border-b border-white/10 pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/55">
                <LockKeyhole size={14} strokeWidth={1.8} />
                Admin only
              </div>
              <h1 className="text-3xl font-medium tracking-normal text-white md:text-5xl">
                Track Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 트랙 추가와
                관리를 위한 관리자 화면입니다.
              </p>
            </div>

            <Link
              href="/archive"
              className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
            >
              Archive 보기
            </Link>
          </header>

          <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
            <form
              onSubmit={onSubmit}
              className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/8 text-white">
                  <Disc3 size={20} strokeWidth={1.8} />
                </span>
                <div>
                  <h2 className="text-lg font-medium text-white">트랙 추가</h2>
                  <p className="mt-1 text-sm text-white/45">
                    다음 단계에서 오디오, 썸네일, 메타데이터 입력 폼을 연결합니다.
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-md border border-white/10 bg-black/18 px-4 py-3">
                <p className="text-sm leading-6 text-white/62">
                  {TRACK_ADMIN_MEMO}
                </p>
              </div>

              <div className="mt-8 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-white/72">제목</span>
                  <input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="I See the Light"
                    required
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/72">부제</span>
                  <input
                    value={form.subtitle}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="라푼젤 (Tangled)"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/72">카테고리</span>
                  <select
                    value={form.categoryId}
                    onChange={(e) => updateField("categoryId", e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition focus:border-white/30"
                    required
                  >
                    {categories.length === 0 && (
                      <option value="">카테고리 없음</option>
                    )}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block md:col-span-2">
                  <span className="text-sm font-medium text-white/72">
                    YouTube URL
                  </span>
                  <input
                    value={form.youtubeUrl}
                    onChange={(e) => updateField("youtubeUrl", e.target.value)}
                    className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="https://youtube.com/..."
                    type="url"
                  />
                </label>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <div className="rounded-md border border-white/10 bg-black/16 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/72">
                    <ImageIcon size={17} strokeWidth={1.8} />
                    썸네일
                  </div>
                  <label
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragTarget("thumbnail");
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setDragTarget("thumbnail");
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragTarget(null);
                    }}
                    onDrop={(e) => onDropFile(e, "thumbnail", setThumbnailFile)}
                    className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition hover:border-white/26 hover:bg-white/[0.03] ${
                      dragTarget === "thumbnail"
                        ? "border-white/45 bg-white/[0.06]"
                        : "border-white/14"
                    }`}
                  >
                    <Upload size={20} strokeWidth={1.7} className="text-white/42" />
                    <span className="mt-2 text-sm text-white/70">
                      {thumbnailFile ? thumbnailFile.name : "이미지 파일 선택 또는 드롭"}
                    </span>
                    <span className="mt-1 text-xs text-white/35">
                      업로드 시 thumbnails 버킷에 저장
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => onFileChange(e, "thumbnail", setThumbnailFile)}
                      className="sr-only"
                    />
                  </label>
                  <input
                    value={form.thumbnailPath}
                    onChange={(e) => updateField("thumbnailPath", e.target.value)}
                    className="mt-3 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-xs text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="또는 기존 thumbnail_path 입력"
                  />
                </div>

                <div className="rounded-md border border-white/10 bg-black/16 p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/72">
                    <FileAudio size={17} strokeWidth={1.8} />
                    오디오
                  </div>
                  <label
                    onDragEnter={(e) => {
                      e.preventDefault();
                      setDragTarget("audio");
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "copy";
                      setDragTarget("audio");
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      setDragTarget(null);
                    }}
                    onDrop={(e) => onDropFile(e, "audio", setAudioFile)}
                    className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition hover:border-white/26 hover:bg-white/[0.03] ${
                      dragTarget === "audio"
                        ? "border-white/45 bg-white/[0.06]"
                        : "border-white/14"
                    }`}
                  >
                    <Upload size={20} strokeWidth={1.7} className="text-white/42" />
                    <span className="mt-2 text-sm text-white/70">
                      {audioFile ? audioFile.name : "오디오 파일 선택 또는 드롭"}
                    </span>
                    <span className="mt-1 text-xs text-white/35">
                      업로드 시 audio 버킷에 저장
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={(e) => onFileChange(e, "audio", setAudioFile)}
                      className="sr-only"
                    />
                  </label>
                  <input
                    value={form.audioPath}
                    onChange={(e) => updateField("audioPath", e.target.value)}
                    className="mt-3 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-xs text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="또는 기존 audio_path 입력"
                  />
                </div>
              </div>

              <div className="mt-7 grid gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-medium text-white/72">김 설명</span>
                  <textarea
                    value={form.descKim}
                    onChange={(e) => updateField("descKim", e.target.value)}
                    className="mt-2 min-h-36 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="트랙 설명"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-medium text-white/72">이 설명</span>
                  <textarea
                    value={form.descLee}
                    onChange={(e) => updateField("descLee", e.target.value)}
                    className="mt-2 min-h-36 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                    placeholder="트랙 설명"
                  />
                </label>
              </div>

              {message && (
                <div
                  className={`mt-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                    message.type === "success"
                      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                      : "border-red-400/20 bg-red-400/10 text-red-100"
                  }`}
                >
                  {message.type === "success" ? (
                    <CheckCircle2 size={17} strokeWidth={1.8} />
                  ) : (
                    <Plus size={17} strokeWidth={1.8} className="rotate-45" />
                  )}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="mt-7 flex justify-end">
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/86 disabled:cursor-not-allowed disabled:bg-white/24 disabled:text-white/35"
                >
                  {submitting ? (
                    <Loader2 size={17} strokeWidth={1.8} className="animate-spin" />
                  ) : (
                    <Plus size={17} strokeWidth={1.8} />
                  )}
                  추가
                </button>
              </div>
            </form>

            <aside className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
              <h2 className="text-sm font-medium text-white/72">Access</h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-white/35">Required role</dt>
                  <dd className="mt-1 font-medium text-white">admin</dd>
                </div>
                <div>
                  <dt className="text-white/35">Profile ID</dt>
                  <dd className="mt-1 break-all text-white/62">{admin.id}</dd>
                </div>
              </dl>

              <div className="mt-8 border-t border-white/10 pt-5">
                <h2 className="text-sm font-medium text-white/72">Storage</h2>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-white/35">Audio bucket</dt>
                    <dd className="mt-1 font-medium text-white">
                      {TRACK_AUDIO_BUCKET}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-white/35">Thumbnail bucket</dt>
                    <dd className="mt-1 font-medium text-white">
                      {TRACK_THUMBNAIL_BUCKET}
                    </dd>
                  </div>
                </dl>
              </div>
            </aside>
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5 md:p-6">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-lg font-medium text-white">기존 트랙 수정 / 삭제</h2>
                <p className="mt-1 text-sm text-white/45">
                  전체 트랙 중 하나를 선택하면 아래 양식에서 바로 수정할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadTracks()}
                disabled={tracksLoading}
                className="inline-flex h-9 items-center justify-center rounded-md border border-white/12 px-3 text-sm font-medium text-white/65 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
              >
                {tracksLoading ? "불러오는 중" : "새로고침"}
              </button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
              <div className="rounded-md border border-white/10 bg-black/16 p-3">
                {tracksError && (
                  <div className="mb-3 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                    {tracksError}
                  </div>
                )}

                <div className="max-h-[560px] space-y-2 overflow-y-auto pr-1">
                  {tracksLoading && (
                    <div className="flex items-center gap-2 px-2 py-4 text-sm text-white/45">
                      <Loader2 size={16} className="animate-spin" />
                      트랙을 불러오고 있습니다.
                    </div>
                  )}

                  {!tracksLoading && tracks.length === 0 && !tracksError && (
                    <div className="px-2 py-4 text-sm text-white/45">
                      등록된 트랙이 없습니다.
                    </div>
                  )}

                  {tracks.map((track) => {
                    const selected = String(track.id) === selectedTrackId;
                    const category = categories.find(
                      (item) => item.id === track.category_id
                    );

                    return (
                      <button
                        key={track.id}
                        type="button"
                        onClick={() => onSelectTrack(String(track.id))}
                        className={`w-full rounded-md border px-3 py-3 text-left transition ${
                          selected
                            ? "border-white/30 bg-white/[0.08]"
                            : "border-white/8 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.045]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium text-white/82">
                            {track.title}
                          </span>
                          <span className="shrink-0 text-xs text-white/35">
                            #{track.id}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-xs text-white/42">
                          {track.subtitle || "부제 없음"}
                        </div>
                        <div className="mt-2 text-xs text-white/30">
                          {category?.name ?? "카테고리 없음"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form
                onSubmit={onUpdateTrack}
                className="rounded-md border border-white/10 bg-black/16 p-4 md:p-5"
              >
                {!selectedTrack ? (
                  <div className="flex min-h-80 items-center justify-center rounded-md border border-dashed border-white/12 px-5 text-center">
                    <div>
                      <Disc3
                        size={28}
                        strokeWidth={1.6}
                        className="mx-auto mb-3 text-white/35"
                      />
                      <p className="text-sm font-medium text-white/65">
                        왼쪽에서 수정할 트랙을 선택해주세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-xs text-white/35">
                          Editing #{selectedTrack.id}
                        </div>
                        <h3 className="mt-1 text-base font-medium text-white">
                          {selectedTrack.title}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={onDeleteTrack}
                        disabled={editDeleting || editSubmitting}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-red-300/20 px-3 text-sm font-medium text-red-100 transition hover:border-red-300/35 hover:bg-red-400/10 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {editDeleting ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} strokeWidth={1.8} />
                        )}
                        삭제
                      </button>
                    </div>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-white/72">제목</span>
                        <input
                          value={editForm.title}
                          onChange={(e) => updateEditField("title", e.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                          required
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white/72">부제</span>
                        <input
                          value={editForm.subtitle}
                          onChange={(e) => updateEditField("subtitle", e.target.value)}
                          className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white/72">
                          카테고리
                        </span>
                        <select
                          value={editForm.categoryId}
                          onChange={(e) =>
                            updateEditField("categoryId", e.target.value)
                          }
                          className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition focus:border-white/30"
                          required
                        >
                          {categories.length === 0 && (
                            <option value="">카테고리 없음</option>
                          )}
                          {categories.map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white/72">
                          YouTube URL
                        </span>
                        <input
                          value={editForm.youtubeUrl}
                          onChange={(e) =>
                            updateEditField("youtubeUrl", e.target.value)
                          }
                          className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                          type="url"
                        />
                      </label>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <div className="rounded-md border border-white/10 bg-white/[0.025] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/72">
                          <ImageIcon size={17} strokeWidth={1.8} />
                          썸네일 교체
                        </div>
                        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/14 px-4 py-4 text-center transition hover:border-white/26 hover:bg-white/[0.03]">
                          <Upload size={18} strokeWidth={1.7} className="text-white/42" />
                          <span className="mt-2 text-sm text-white/70">
                            {editThumbnailFile
                              ? editThumbnailFile.name
                              : "새 이미지 선택"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              onFileChange(e, "thumbnail", setEditThumbnailFile)
                            }
                            className="sr-only"
                          />
                        </label>
                        <input
                          value={editForm.thumbnailPath}
                          onChange={(e) =>
                            updateEditField("thumbnailPath", e.target.value)
                          }
                          className="mt-3 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-xs text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                          placeholder="thumbnail_path"
                        />
                      </div>

                      <div className="rounded-md border border-white/10 bg-white/[0.025] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white/72">
                          <FileAudio size={17} strokeWidth={1.8} />
                          오디오 교체
                        </div>
                        <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-white/14 px-4 py-4 text-center transition hover:border-white/26 hover:bg-white/[0.03]">
                          <Upload size={18} strokeWidth={1.7} className="text-white/42" />
                          <span className="mt-2 text-sm text-white/70">
                            {editAudioFile ? editAudioFile.name : "새 오디오 선택"}
                          </span>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={(e) =>
                              onFileChange(e, "audio", setEditAudioFile)
                            }
                            className="sr-only"
                          />
                        </label>
                        <input
                          value={editForm.audioPath}
                          onChange={(e) => updateEditField("audioPath", e.target.value)}
                          className="mt-3 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-xs text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                          placeholder="audio_path"
                        />
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="text-sm font-medium text-white/72">
                          김 설명
                        </span>
                        <textarea
                          value={editForm.descKim}
                          onChange={(e) => updateEditField("descKim", e.target.value)}
                          className="mt-2 min-h-32 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-medium text-white/72">
                          이 설명
                        </span>
                        <textarea
                          value={editForm.descLee}
                          onChange={(e) => updateEditField("descLee", e.target.value)}
                          className="mt-2 min-h-32 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                        />
                      </label>
                    </div>

                    {editMessage && (
                      <div
                        className={`mt-6 flex items-start gap-2 rounded-md border px-4 py-3 text-sm ${
                          editMessage.type === "success"
                            ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100"
                            : "border-red-400/20 bg-red-400/10 text-red-100"
                        }`}
                      >
                        {editMessage.type === "success" ? (
                          <CheckCircle2 size={17} strokeWidth={1.8} />
                        ) : (
                          <Plus size={17} strokeWidth={1.8} className="rotate-45" />
                        )}
                        <span>{editMessage.text}</span>
                      </div>
                    )}

                    <div className="mt-7 flex justify-end">
                      <button
                        type="submit"
                        disabled={!canUpdate}
                        className="inline-flex h-11 min-w-32 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/86 disabled:cursor-not-allowed disabled:bg-white/24 disabled:text-white/35"
                      >
                        {editSubmitting ? (
                          <Loader2
                            size={17}
                            strokeWidth={1.8}
                            className="animate-spin"
                          />
                        ) : (
                          <Save size={17} strokeWidth={1.8} />
                        )}
                        수정 저장
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<AdminTracksPageProps> = async (
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

  const [
    { data: profile, error: profileError },
    { data: categoriesData, error: categoriesError },
  ] = await Promise.all([
    supabase
    .from("profiles")
    .select("id, nickname, role")
    .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("archive_categories")
      .select("id, name")
      .order("id", { ascending: true }),
  ]);

  if (profileError || profile?.role !== "admin") {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  if (categoriesError) {
    return {
      props: {
        admin: {
          id: profile.id,
          nickname: profile.nickname ?? null,
        },
        categories: [],
      },
    };
  }

  return {
    props: {
      admin: {
        id: profile.id,
        nickname: profile.nickname ?? null,
      },
      categories: (categoriesData ?? []) as ArchiveCategory[],
    },
  };
};
