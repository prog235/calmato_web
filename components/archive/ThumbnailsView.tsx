import { Download, Info, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import HorizontalCarousel from "@/components/archive/HorizontalCarousel";
import { supabase } from "@/lib/supabaseClient";

type Wallpaper = {
  id?: number | string;
  image_path?: string | null;
  imagePath?: string | null;
  path?: string | null;
  storage_path?: string | null;
  title?: string | null;
  name?: string | null;
  subtitle?: string | null;
  description?: string | null;
  [key: string]: unknown;
};

type FolderFilter = "all" | "created" | "taken";

const WALLPAPERS_BUCKET = "wallpapers";
const FEATURE_MIN_HEIGHT = 420;
const folderFilterOptions: FolderFilter[] = ["all", "created", "taken"];

const labelMap: Record<string, string> = {
  id: "ID",
  title: "제목",
  name: "이름",
  subtitle: "부제",
  description: "설명",
  image_path: "이미지 경로",
  imagePath: "이미지 경로",
  path: "이미지 경로",
  storage_path: "이미지 경로",
  resolution: "해상도",
  type: "형식",
  file_format: "파일 형식",
  format: "파일 형식",
  color_mode: "색상 모드",
  color_profile: "색상 프로필",
  production_method: "제작 방식",
  method: "제작 방식",
  created_at: "등록일",
  updated_at: "수정일",
};

const hiddenDetailKeys = new Set([
  "id",
  "title",
  "name",
  "subtitle",
  "description",
  "image_path",
  "imagePath",
  "path",
  "storage_path",
  "created_at",
  "width",
  "height",
]);

function getWallpaperUrl(path?: string | null) {
  if (!path) return "";

  const { data } = supabase.storage.from(WALLPAPERS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function getWallpaperPath(wallpaper: Wallpaper | null) {
  return wallpaper?.image_path ?? wallpaper?.imagePath ?? wallpaper?.path ?? wallpaper?.storage_path ?? null;
}

function getWallpaperTitle(wallpaper: Wallpaper | null) {
  if (!wallpaper) return "Wallpaper";
  const path = getWallpaperPath(wallpaper);

  return String(
    wallpaper.title ??
      wallpaper.name ??
      wallpaper.subtitle ??
      path?.split("/").pop()?.replace(/\.[^.]+$/, "") ??
      "Wallpaper"
  );
}

function getFolder(path?: string | null): FolderFilter {
  if (path?.startsWith("created/")) return "created";
  if (path?.startsWith("taken/")) return "taken";
  return "all";
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  }

  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);

  return String(value);
}

function formatLabel(key: string) {
  return labelMap[key] ?? key.replace(/_/g, " ");
}

function getDownloadName(path: string) {
  return path.split("/").pop() ?? "calmato-wallpaper.jpg";
}

function getOriginText(path?: string | null) {
  const folder = getFolder(path);

  if (folder === "created") {
    return 'Calmato에서 AI를 활용하여 제작한 이미지입니다.';
  }

  if (folder === "taken") {
    return 'Calmato에서 직접 촬영한 이미지입니다.';
  }

  return "Calmato에서 제작한 이미지입니다.";
}

function matchesSearch(wallpaper: Wallpaper, query: string) {
  const keyword = query.trim().toLowerCase();
  if (!keyword) return true;

  const title = String(wallpaper.title ?? wallpaper.name ?? "").toLowerCase();
  const subtitle = String(wallpaper.subtitle ?? "").toLowerCase();

  return title.includes(keyword) || subtitle.includes(keyword);
}

export default function ThumbnailsView() {
  const [wallpapers, setWallpapers] = useState<Wallpaper[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [imageFrameHeight, setImageFrameHeight] = useState<number | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWallpapers() {
      setLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase.from("wallpapers").select("*");

      if (cancelled) return;

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      const rows = ((data ?? []) as Wallpaper[]).filter((row) => getWallpaperPath(row));
      setWallpapers(rows);
      setSelectedPath(getWallpaperPath(rows[0] ?? null));
      setLoading(false);
    }

    void loadWallpapers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const frame = imageFrameRef.current;
    if (!frame) return;

    const updateHeight = () => {
      setImageFrameHeight(frame.getBoundingClientRect().height);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(frame);

    return () => observer.disconnect();
  }, [selectedPath]);

  const visibleWallpapers = useMemo(() => {
    return wallpapers.filter((wallpaper) => {
      const matchesFolder =
        folderFilter === "all" || getFolder(getWallpaperPath(wallpaper)) === folderFilter;

      return matchesFolder && matchesSearch(wallpaper, searchQuery);
    });
  }, [folderFilter, searchQuery, wallpapers]);

  const selectedWallpaper = useMemo(() => {
    return wallpapers.find((wallpaper) => getWallpaperPath(wallpaper) === selectedPath) ?? wallpapers[0] ?? null;
  }, [selectedPath, wallpapers]);

  const selectedImagePath = getWallpaperPath(selectedWallpaper);
  const selectedUrl = getWallpaperUrl(selectedImagePath);
  const title = getWallpaperTitle(selectedWallpaper);
  const width = formatValue(selectedWallpaper?.width);
  const height = formatValue(selectedWallpaper?.height);
  const resolution = selectedWallpaper?.resolution ?? (width && height ? `${width} * ${height}` : null);
  const details = selectedWallpaper
    ? [
        ...(resolution ? [["resolution", resolution] as [string, unknown]] : []),
        ...Object.entries(selectedWallpaper).filter(([key]) => key !== "resolution"),
      ]
        .filter(([key]) => !hiddenDetailKeys.has(key))
        .filter(([, value]) => formatValue(value) !== null)
        .sort(([a], [b]) => {
          const order = ["resolution", "file_format", "format", "color_mode", "color_profile", "production_method", "method"];
          const aIndex = order.indexOf(a);
          const bIndex = order.indexOf(b);
          if (aIndex === -1 && bIndex === -1) return 0;
          if (aIndex === -1) return 1;
          if (bIndex === -1) return -1;
          return aIndex - bIndex;
        })
    : [];
  const activeFilterIndex = folderFilterOptions.indexOf(folderFilter);

  async function downloadSelectedWallpaper() {
    if (!selectedImagePath || !accepted || downloading) return;

    setDownloading(true);

    try {
      const { data, error } = await supabase.storage
        .from(WALLPAPERS_BUCKET)
        .download(selectedImagePath);

      if (error || !data) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = getDownloadName(selectedImagePath);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("파일 다운로드 중 오류가 발생했습니다.");
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <div className="subtext">Loading wallpapers...</div>;
  }

  if (errorMessage && wallpapers.length === 0) {
    return (
      <div className="rounded-lg border border-white/10 p-6 text-sm text-red-300">
        {errorMessage}
      </div>
    );
  }

  return (
    <section
      className="space-y-10"
      onContextMenu={(event) => event.preventDefault()}
    >
      {selectedWallpaper ? (
        <div className="grid min-w-0 gap-10 lg:min-w-[1180px] lg:grid-cols-[minmax(760px,1.7fr)_minmax(340px,0.98fr)]">
          <div
            className="relative mt-3 flex min-w-0 items-start lg:min-w-[760px]"
            style={{ minHeight: FEATURE_MIN_HEIGHT }}
          >
            <div
              ref={imageFrameRef}
              className="relative aspect-[16/9] w-full overflow-hidden bg-white/[0.025] shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
              style={{
                clipPath:
                  "polygon(24px 0, 100% 0, 100% calc(100% - 24px), calc(100% - 24px) 100%, 0 100%, 0 24px)",
              }}
            >
              <img
                src={selectedUrl}
                alt={title}
                draggable={false}
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/12" />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-6 h-px w-9 origin-left -rotate-45 bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.16)]"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-6 right-0 h-px w-9 origin-right -rotate-45 bg-white/20 shadow-[0_0_10px_rgba(255,255,255,0.16)]"
              />
            </div>
          </div>

          <aside
            className="mt-3 flex flex-col overflow-y-auto rounded-lg border border-white/10 bg-white/[0.035] p-5"
            style={{
              minHeight: FEATURE_MIN_HEIGHT,
              ...(imageFrameHeight ? { height: imageFrameHeight } : {}),
            }}
          >
            <h2 className="text-[15px] font-semibold leading-6 text-white">
              {title}
            </h2>

          {selectedWallpaper.subtitle ? (
            <p className="mt-1 text-sm leading-6 text-white/72">
              {String(selectedWallpaper.subtitle)}
            </p>
          ) : null}

          {selectedWallpaper.description ? (
            <p className="mt-2 text-sm leading-6 text-white/70">
              {String(selectedWallpaper.description)}
            </p>
          ) : null}

          <div className="mt-5 border-t border-white/8 pt-4">
            <dl className="space-y-2.5 text-xs">
              {details.map(([key, value]) => {
                const formatted = formatValue(value);
                if (!formatted) return null;

                return (
                  <div key={key} className="grid grid-cols-[82px_minmax(0,1fr)] gap-4">
                    <dt className="text-white/42">{formatLabel(key)}</dt>
                    <dd className="break-words text-white/68">{formatted}</dd>
                  </div>
                );
              })}
            </dl>
          </div>

          <div className="mt-auto pt-5">
            <div className="rounded-md border border-white/10 p-4">
              <div className="flex gap-3">
                <Info size={18} className="mt-0.5 shrink-0 text-white/80" />
                <p className="text-xs leading-5 text-white/72">
                  {getOriginText(selectedImagePath)} 개인 감상 및 소장 목적으로만 저장할 수 있으며,
                  상업적 사용, 재판매, 재배포, 무단 수정 및 2차 가공은 허용되지 않습니다.
                </p>
              </div>
            </div>

            <label className="mt-5 flex items-center gap-3 text-xs text-white/55">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5"
              />
              위 안내 사항을 확인했으며, 이에 동의합니다.
            </label>

            {errorMessage ? (
              <p className="mt-3 text-xs text-red-300">{errorMessage}</p>
            ) : null}

            <button
              type="button"
              onClick={downloadSelectedWallpaper}
              disabled={!accepted || downloading}
              className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-white/14 text-sm text-white/72 transition hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={17} />
              {downloading ? "다운로드 중..." : "다운로드"}
            </button>
          </div>
          </aside>
        </div>
      ) : (
        <div className="rounded-lg border border-white/10 p-6">
          <h2 className="mb-2 text-lg font-semibold">Thumbnails</h2>
          <p className="subtext">
            등록된 월페이퍼가 없습니다.
          </p>
        </div>
      )}

      <div className="space-y-5">
        <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
          <div className="hidden sm:block" />
          <div
            className="relative grid h-10 w-full max-w-[280px] grid-cols-3 rounded-full border border-white/10 bg-white/[0.055] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:w-[310px]"
            role="tablist"
            aria-label="Wallpaper source filter"
          >
            <span
              aria-hidden="true"
              className="absolute bottom-1 left-1 top-1 rounded-full bg-white/16 shadow-[0_8px_24px_rgba(0,0,0,0.22)] transition-transform duration-300 ease-out"
              style={{
                width: "calc((100% - 8px) / 3)",
                transform: `translateX(${activeFilterIndex * 100}%)`,
              }}
            />

            {folderFilterOptions.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setFolderFilter(filter)}
                role="tab"
                aria-selected={folderFilter === filter}
                className={[
                  "relative z-10 rounded-xl px-3 text-sm capitalize transition",
                  folderFilter === filter
                    ? "text-white"
                    : "text-white/45 hover:text-white/70",
                ].join(" ")}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:ml-auto sm:w-[320px]">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              aria-hidden="true"
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="제목, 부제목 검색"
              className="h-[38px] w-full rounded-xl bg-white/5 pl-10 pr-3 text-sm text-white/85 ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
        </div>

        {wallpapers.length > 0 && visibleWallpapers.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-white/[0.025] px-4 py-5 text-center text-sm text-white/52">
            검색 결과가 없습니다.
          </div>
        ) : null}

        <HorizontalCarousel className="pb-1" speed={1.6}>
          {visibleWallpapers.map((wallpaper) => {
            const path = getWallpaperPath(wallpaper);
            if (!path) return null;

            const active = path === selectedImagePath;

            return (
              <button
                key={String(wallpaper.id ?? path)}
                type="button"
                onClick={() => {
                  setSelectedPath(path);
                  setAccepted(false);
                  setErrorMessage(null);
                }}
                className={[
                  "h-[74px] w-[132px] shrink-0 overflow-hidden rounded-md border bg-white/[0.025] p-0.5 transition",
                  active
                    ? "border-white/85"
                    : "border-white/10 opacity-70 hover:border-white/30 hover:opacity-100",
                ].join(" ")}
                aria-label={`${getWallpaperTitle(wallpaper)} 선택`}
              >
                <img
                  src={getWallpaperUrl(path)}
                  alt=""
                  draggable={false}
                  className="h-full w-full rounded-[4px] object-cover"
                />
              </button>
            );
          })}
        </HorizontalCarousel>
      </div>
    </section>
  );
}
