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
  GripVertical,
  Image as ImageIcon,
  ListMusic,
  Loader2,
  LockKeyhole,
  Plus,
  Upload,
  X,
} from "lucide-react";

import { supabaseServerForGSSP } from "@/lib/supabaseGSSP";
import { supabase } from "@/lib/supabaseClient";

const PLAYLIST_THUMBNAIL_BUCKET = "thumbnails";

type ArchiveCategory = {
  id: number;
  name: string;
};

type TrackRow = {
  id: number;
  title: string;
  subtitle: string | null;
  category_id: number | null;
};

type AdminPlaylistsPageProps = {
  admin: {
    id: string;
    nickname: string | null;
  };
  categories: ArchiveCategory[];
};

type PlaylistFormState = {
  title: string;
  slug: string;
  categoryId: string;
  thumbnailPath: string;
  youtubeUrl: string;
  descKim: string;
  descLee: string;
  isAsmr: boolean;
  showInCategory: boolean;
};

const initialForm: PlaylistFormState = {
  title: "",
  slug: "",
  categoryId: "",
  thumbnailPath: "",
  youtubeUrl: "",
  descKim: "",
  descLee: "",
  isAsmr: false,
  showInCategory: true,
};

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function makeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function makeThumbnailPath(categoryId: string, file: File) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return `playlists/category-${categoryId}/thumbnail-${uuid}_${safeFileName(
    file.name
  )}`;
}

function normalizeText(value: string) {
  return value.trim();
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function AdminPlaylistsPage({
  admin,
  categories,
}: AdminPlaylistsPageProps) {
  const [form, setForm] = useState<PlaylistFormState>(() => ({
    ...initialForm,
    categoryId: categories[0]?.id ? String(categories[0].id) : "",
  }));
  const [tracks, setTracks] = useState<TrackRow[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksError, setTracksError] = useState<string | null>(null);
  const [trackSearch, setTrackSearch] = useState("");
  const [selectedTrackIds, setSelectedTrackIds] = useState<number[]>([]);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [draggingTrackId, setDraggingTrackId] = useState<number | null>(null);
  const [thumbnailDragging, setThumbnailDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedTracks = useMemo(() => {
    const trackMap = new Map(tracks.map((track) => [track.id, track]));
    return selectedTrackIds
      .map((id) => trackMap.get(id))
      .filter((track): track is TrackRow => Boolean(track));
  }, [selectedTrackIds, tracks]);

  const filteredTracks = useMemo(() => {
    const query = trackSearch.trim().toLowerCase();
    if (!query) return tracks;

    return tracks.filter((track) => {
      return [
        track.title,
        track.subtitle ?? "",
        String(track.id),
      ].some((value) => value.toLowerCase().includes(query));
    });
  }, [trackSearch, tracks]);

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.slug.trim().length > 0 &&
      form.categoryId.trim().length > 0 &&
      selectedTrackIds.length > 0 &&
      (form.thumbnailPath.trim().length > 0 || thumbnailFile !== null) &&
      !submitting
    );
  }, [
    form.categoryId,
    form.slug,
    form.thumbnailPath,
    form.title,
    selectedTrackIds.length,
    submitting,
    thumbnailFile,
  ]);

  useEffect(() => {
    void loadTracks();
  }, []);

  function updateField<K extends keyof PlaylistFormState>(
    key: K,
    value: PlaylistFormState[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateTitle(value: string) {
    setForm((prev) => ({
      ...prev,
      title: value,
      slug: prev.slug === makeSlug(prev.title) ? makeSlug(value) : prev.slug,
    }));
  }

  async function loadTracks() {
    setTracksLoading(true);
    setTracksError(null);

    const { data, error } = await supabase
      .from("tracks")
      .select("id, title, subtitle, category_id")
      .order("id", { ascending: true });

    if (error) {
      setTracks([]);
      setTracksError(error.message);
      setTracksLoading(false);
      return;
    }

    setTracks((data ?? []) as TrackRow[]);
    setTracksLoading(false);
  }

  function setAcceptedThumbnail(file: File) {
    if (!file.type.startsWith("image/")) {
      setMessage({
        type: "error",
        text: "플레이리스트 썸네일에는 이미지 파일만 사용할 수 있습니다.",
      });
      return;
    }

    setMessage(null);
    setThumbnailFile(file);
  }

  function onThumbnailChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setAcceptedThumbnail(file);
  }

  function onThumbnailDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setThumbnailDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) setAcceptedThumbnail(file);
  }

  function toggleTrack(trackId: number) {
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      }

      return [...prev, trackId];
    });
  }

  function removeSelectedTrack(trackId: number) {
    setSelectedTrackIds((prev) => prev.filter((id) => id !== trackId));
  }

  function onSelectedTrackDrop(targetTrackId: number) {
    if (draggingTrackId === null || draggingTrackId === targetTrackId) {
      setDraggingTrackId(null);
      return;
    }

    setSelectedTrackIds((prev) => {
      const from = prev.indexOf(draggingTrackId);
      const to = prev.indexOf(targetTrackId);

      if (from === -1 || to === -1) return prev;
      return moveItem(prev, from, to);
    });
    setDraggingTrackId(null);
  }

  async function uploadThumbnail(path: string, file: File) {
    const { error } = await supabase.storage
      .from(PLAYLIST_THUMBNAIL_BUCKET)
      .upload(path, file, {
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
        text: "제목, slug, 카테고리, 썸네일, 선택된 트랙을 확인해주세요.",
      });
      return;
    }

    setSubmitting(true);
    let uploadedThumbnailPath: string | null = null;
    let createdPlaylistId: number | null = null;

    try {
      let thumbnailPath = form.thumbnailPath.trim();

      if (thumbnailFile) {
        thumbnailPath = makeThumbnailPath(form.categoryId, thumbnailFile);
        await uploadThumbnail(thumbnailPath, thumbnailFile);
        uploadedThumbnailPath = thumbnailPath;
      }

      const { data: playlist, error: playlistError } = await supabase
        .from("playlists")
        .insert({
          title: form.title.trim(),
          slug: form.slug.trim(),
          thumbnail_path: thumbnailPath,
          youtube_url: normalizeText(form.youtubeUrl),
          desc_kim: normalizeText(form.descKim),
          desc_lee: normalizeText(form.descLee),
          is_asmr: form.isAsmr,
          track_n: selectedTrackIds.length,
          category_id: Number(form.categoryId),
          show_in_category: form.showInCategory,
        })
        .select("id")
        .single();

      if (playlistError) throw playlistError;

      createdPlaylistId = playlist.id;

      const joinRows = selectedTrackIds.map((trackId, index) => ({
        playlist_id: createdPlaylistId,
        track_id: trackId,
        position: index + 1,
      }));

      const { error: joinError } = await supabase
        .from("playlist_tracks")
        .insert(joinRows);

      if (joinError) throw joinError;

      setForm({
        ...initialForm,
        categoryId: form.categoryId,
      });
      setSelectedTrackIds([]);
      setThumbnailFile(null);
      setMessage({
        type: "success",
        text: `플레이리스트가 생성되었습니다. ID: ${createdPlaylistId}`,
      });
    } catch (err) {
      if (createdPlaylistId !== null) {
        await supabase.from("playlists").delete().eq("id", createdPlaylistId);
      }

      if (uploadedThumbnailPath) {
        await supabase.storage
          .from(PLAYLIST_THUMBNAIL_BUCKET)
          .remove([uploadedThumbnailPath]);
      }

      setMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "플레이리스트 생성 중 오류가 발생했습니다.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head>
        <title>Playlist Admin | Calmato</title>
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
                Playlist Admin
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55 md:text-base">
                {admin.nickname ?? "Admin"} 계정으로 접속 중입니다. 플레이리스트
                생성과 트랙 순서를 관리합니다.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/tracks"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Track Admin
              </Link>
              <Link
                href="/archive"
                className="inline-flex h-10 items-center justify-center rounded-md border border-white/12 px-4 text-sm font-medium text-white/70 transition hover:border-white/24 hover:bg-white/[0.04] hover:text-white"
              >
                Archive 보기
              </Link>
            </div>
          </header>

          <form
            onSubmit={onSubmit}
            className="rounded-lg border border-white/10 bg-white/[0.035] p-5 md:p-6"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/8 text-white">
                <ListMusic size={20} strokeWidth={1.8} />
              </span>
              <div>
                <h2 className="text-lg font-medium text-white">플레이리스트 생성</h2>
                <p className="mt-1 text-sm text-white/45">
                  트랙을 선택한 순서대로 playlist_tracks.position에 저장합니다.
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white/72">제목</span>
                <input
                  value={form.title}
                  onChange={(e) => updateTitle(e.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="Disney ASMR Part.1"
                  required
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/72">Slug</span>
                <input
                  value={form.slug}
                  onChange={(e) => updateField("slug", makeSlug(e.target.value))}
                  className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="disney-part-1-asmr"
                  required
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
                  {categories.length === 0 && <option value="">카테고리 없음</option>}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/72">YouTube URL</span>
                <input
                  value={form.youtubeUrl}
                  onChange={(e) => updateField("youtubeUrl", e.target.value)}
                  className="mt-2 h-11 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="https://youtube.com/..."
                  type="url"
                />
              </label>

              <label className="flex h-11 items-center justify-between rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white/72">
                <span>ASMR 표시</span>
                <input
                  type="checkbox"
                  checked={form.isAsmr}
                  onChange={(e) => updateField("isAsmr", e.target.checked)}
                  className="h-4 w-4 accent-white"
                />
              </label>

              <label className="flex h-11 items-center justify-between rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white/72">
                <span>카테고리 탭에 표시</span>
                <input
                  type="checkbox"
                  checked={form.showInCategory}
                  onChange={(e) => updateField("showInCategory", e.target.checked)}
                  className="h-4 w-4 accent-white"
                />
              </label>
            </div>

            <div className="mt-7 rounded-md border border-white/10 bg-black/16 p-4">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-white/72">
                <ImageIcon size={17} strokeWidth={1.8} />
                플레이리스트 썸네일
              </div>
              <label
                onDragEnter={(e) => {
                  e.preventDefault();
                  setThumbnailDragging(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                  setThumbnailDragging(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  setThumbnailDragging(false);
                }}
                onDrop={onThumbnailDrop}
                className={`flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-4 py-5 text-center transition hover:border-white/26 hover:bg-white/[0.03] ${
                  thumbnailDragging
                    ? "border-white/45 bg-white/[0.06]"
                    : "border-white/14"
                }`}
              >
                <Upload size={20} strokeWidth={1.7} className="text-white/42" />
                <span className="mt-2 text-sm text-white/70">
                  {thumbnailFile
                    ? thumbnailFile.name
                    : "이미지 파일 선택 또는 드롭"}
                </span>
                <span className="mt-1 text-xs text-white/35">
                  업로드 시 thumbnails 버킷에 저장
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={onThumbnailChange}
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

            <div className="mt-7 grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-medium text-white/72">김 설명</span>
                <textarea
                  value={form.descKim}
                  onChange={(e) => updateField("descKim", e.target.value)}
                  className="mt-2 min-h-32 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="플레이리스트 설명"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-white/72">이 설명</span>
                <textarea
                  value={form.descLee}
                  onChange={(e) => updateField("descLee", e.target.value)}
                  className="mt-2 min-h-32 w-full resize-y rounded-md border border-white/10 bg-black/24 px-3 py-3 text-sm leading-6 text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="플레이리스트 설명"
                />
              </label>
            </div>

            <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="rounded-md border border-white/10 bg-black/16 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-white/72">트랙 선택</h3>
                  <button
                    type="button"
                    onClick={() => loadTracks()}
                    disabled={tracksLoading}
                    className="inline-flex h-8 items-center rounded-md border border-white/10 px-3 text-xs text-white/58 transition hover:bg-white/[0.04] hover:text-white disabled:opacity-45"
                  >
                    {tracksLoading ? "로딩 중" : "새로고침"}
                  </button>
                </div>

                <input
                  value={trackSearch}
                  onChange={(e) => setTrackSearch(e.target.value)}
                  className="mt-4 h-10 w-full rounded-md border border-white/10 bg-black/24 px-3 text-sm text-white outline-none transition placeholder:text-white/24 focus:border-white/30"
                  placeholder="트랙 이름, 부제, ID 검색"
                />

                {tracksError && (
                  <div className="mt-4 rounded-md border border-red-400/20 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                    {tracksError}
                  </div>
                )}

                <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {tracksLoading && (
                    <div className="flex items-center gap-2 py-4 text-sm text-white/45">
                      <Loader2 size={16} className="animate-spin" />
                      트랙을 불러오고 있습니다.
                    </div>
                  )}

                  {!tracksLoading && tracks.length === 0 && !tracksError && (
                    <div className="py-4 text-sm text-white/45">
                      등록된 트랙이 없습니다.
                    </div>
                  )}

                  {!tracksLoading &&
                    tracks.length > 0 &&
                    filteredTracks.length === 0 && (
                      <div className="py-4 text-sm text-white/45">
                        검색 결과가 없습니다.
                      </div>
                    )}

                  {filteredTracks.map((track) => {
                    const checked = selectedTrackIds.includes(track.id);
                    const category = categories.find(
                      (item) => item.id === track.category_id
                    );

                    return (
                      <label
                        key={track.id}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-3 transition ${
                          checked
                            ? "border-white/28 bg-white/[0.07]"
                            : "border-white/8 bg-white/[0.025] hover:border-white/18 hover:bg-white/[0.045]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleTrack(track.id)}
                          className="mt-1 h-4 w-4 accent-white"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-white/82">
                            {track.title}
                          </span>
                          <span className="mt-1 block truncate text-xs text-white/42">
                            {track.subtitle || "부제 없음"}
                          </span>
                          <span className="mt-2 block text-xs text-white/30">
                            {category?.name ?? "카테고리 없음"} · #{track.id}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-md border border-white/10 bg-black/16 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-white/72">
                    선택된 트랙 순서
                  </h3>
                  <span className="text-xs text-white/40">
                    track_n: {selectedTracks.length}
                  </span>
                </div>

                <div className="mt-4 space-y-2">
                  {selectedTracks.length === 0 && (
                    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-white/12 px-4 text-center text-sm text-white/42">
                      선택된 트랙이 없습니다.
                    </div>
                  )}

                  {selectedTracks.map((track, index) => (
                    <div
                      key={track.id}
                      draggable
                      onDragStart={() => setDraggingTrackId(track.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onSelectedTrackDrop(track.id)}
                      onDragEnd={() => setDraggingTrackId(null)}
                      className={`flex cursor-grab items-center gap-3 rounded-md border px-3 py-3 transition active:cursor-grabbing ${
                        draggingTrackId === track.id
                          ? "border-white/35 bg-white/[0.08] opacity-70"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <GripVertical
                        size={17}
                        strokeWidth={1.8}
                        className="shrink-0 text-white/38"
                      />
                      <span className="w-6 shrink-0 text-xs text-white/38">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-white/78">
                          {track.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-white/38">
                          {track.subtitle || "부제 없음"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeSelectedTrack(track.id)}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white/42 transition hover:bg-white/[0.06] hover:text-white"
                        aria-label="선택 해제"
                      >
                        <X size={16} strokeWidth={1.8} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </section>

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
                className="inline-flex h-11 min-w-40 items-center justify-center gap-2 rounded-md bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/86 disabled:cursor-not-allowed disabled:bg-white/24 disabled:text-white/35"
              >
                {submitting ? (
                  <Loader2 size={17} strokeWidth={1.8} className="animate-spin" />
                ) : (
                  <Plus size={17} strokeWidth={1.8} />
                )}
                플레이리스트 생성
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps<
  AdminPlaylistsPageProps
> = async (ctx) => {
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

  return {
    props: {
      admin: {
        id: profile.id,
        nickname: profile.nickname ?? null,
      },
      categories: categoriesError ? [] : ((categoriesData ?? []) as ArchiveCategory[]),
    },
  };
};
