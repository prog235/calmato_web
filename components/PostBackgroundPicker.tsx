import { useEffect, useMemo, useState } from "react";
import { Check, Eye, Heart, MessageCircle, Palette, X } from "lucide-react";
import { getImage } from "@/lib/getUrl";
import ProfileAvatar from "@/components/ProfileAvatar";

export type PostBackgroundKind = "none" | "color" | "uploaded" | "asset";

export type PostBackgroundSelection = {
  type: PostBackgroundKind;
  value: string | null;
};

type UploadedBackgroundOption = {
  id: string;
  label: string;
  url: string;
};

type PostBackgroundPickerProps = {
  open: boolean;
  selection: PostBackgroundSelection;
  uploadedImages: UploadedBackgroundOption[];
  title: string;
  content: string;
  nickname: string;
  profileImagePath?: string | null;
  onClose: () => void;
  onConfirm: (selection: PostBackgroundSelection) => void;
};

export const POST_BACKGROUND_COLORS = [
  { label: "Ink", value: "#141821" },
  { label: "Moss", value: "#1f342d" },
  { label: "Burgundy", value: "#3a1f2a" },
  { label: "Midnight", value: "#1c2740" },
  { label: "Aubergine", value: "#2d2440" },
  { label: "Teal", value: "#17363b" },
  { label: "Umber", value: "#342b22" },
];

export const POST_BASIC_IMAGES = [
  { label: "Basic 1 : Forest", path: "post_basic_image/basic_1.jpeg" },
  { label: "Basic 2 : Rain", path: "post_basic_image/basic_2.jpg" },
  { label: "Basic 3 : City", path: "post_basic_image/basic_3.jpg" },
  { label: "Basic 4 : Galaxy", path: "post_basic_image/basic_4.jpg" },
  { label: "Basic 5 : Ocean", path: "post_basic_image/basic_5.jpg" },
  { label: "Basic 6 : Fireplace", path: "post_basic_image/basic_6.jpg" },
];

const emptySelection: PostBackgroundSelection = { type: "none", value: null };

function selectionKey(selection: PostBackgroundSelection) {
  return `${selection.type}:${selection.value ?? ""}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolvePostBackgroundPreview(selection: PostBackgroundSelection, options: {
  uploadedImages: UploadedBackgroundOption[];
  getAssetUrl: (path: string) => string;
}) {
  if (selection.type === "color" && selection.value) {
    return { color: selection.value, imageUrl: null };
  }

  if (selection.type === "uploaded" && selection.value) {
    const uploaded = options.uploadedImages.find((image) => image.id === selection.value);
    return { color: null, imageUrl: uploaded?.url ?? null };
  }

  if (selection.type === "asset" && selection.value) {
    return { color: null, imageUrl: options.getAssetUrl(selection.value) };
  }

  return { color: null, imageUrl: null };
}

export default function PostBackgroundPicker({
  open,
  selection,
  uploadedImages,
  title,
  content,
  nickname,
  profileImagePath,
  onClose,
  onConfirm,
}: PostBackgroundPickerProps) {
  const [draftSelection, setDraftSelection] = useState<PostBackgroundSelection>(selection);

  useEffect(() => {
    if (open) setDraftSelection(selection);
  }, [open, selection]);

  const preview = useMemo(
    () =>
      resolvePostBackgroundPreview(draftSelection, {
        uploadedImages,
        getAssetUrl: (path) => getImage("assets", path),
      }),
    [draftSelection, uploadedImages]
  );

  if (!open) return null;

  const excerpt = stripHtml(content) || "오늘의 하루는 어땠나요?";
  const previewTitle = title.trim() || "제목을 입력해 주세요";
  const selectedLabel =
    draftSelection.type === "uploaded"
      ? uploadedImages.find((image) => image.id === draftSelection.value)?.label ?? "업로드 이미지"
      : draftSelection.type === "color"
        ? POST_BACKGROUND_COLORS.find((color) => color.value === draftSelection.value)?.label ?? "단색 배경"
        : draftSelection.type === "asset"
          ? POST_BASIC_IMAGES.find((image) => image.path === draftSelection.value)?.label ?? "기본 이미지"
          : "배경 미설정";
  const selectedSwatchStyle = preview.imageUrl
    ? { backgroundImage: `url(${preview.imageUrl})` }
    : preview.color
      ? { backgroundColor: preview.color }
      : {};
  const previewDate = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(/\s/g, " ");

  function isActive(next: PostBackgroundSelection) {
    return selectionKey(draftSelection) === selectionKey(next);
  }

  function optionClass(next: PostBackgroundSelection) {
    return [
      "group relative overflow-hidden rounded-lg border transition",
      isActive(next)
        ? "border-white/65 ring-2 ring-white/25"
        : "border-white/10 hover:border-white/35",
    ].join(" ");
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/72 px-4 py-5 text-white backdrop-blur-sm sm:px-6 lg:px-8">
      <div className="flex h-[min(84vh,860px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0a0a] shadow-[0_28px_100px_rgba(0,0,0,0.72)]">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-white/88 mt-2">
              <Palette size={16} aria-hidden="true" />
              배경 설정
            </div>
            <div className="my-1 text-xs text-white/38">
              게시물 목록 카드에서 보일 배경을 선택하세요.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/[0.08] hover:text-white"
            aria-label="배경 설정 닫기"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_500px]">
          <div className="min-h-0 space-y-8 overflow-y-auto border-b border-white/10 p-5 sm:p-6 lg:border-b-0 lg:border-r lg:border-white/10">
            <section>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                Uploaded
              </div>
              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {uploadedImages.map((image) => {
                    const next = { type: "uploaded", value: image.id } as const;
                    return (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setDraftSelection(next)}
                        className={`${optionClass(next)} aspect-[16/10] bg-white/[0.03]`}
                        title={image.label}
                      >
                        <img src={image.url} alt="" className="h-full w-full object-cover" />
                        {isActive(next) && (
                          <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                            <Check size={13} aria-hidden="true" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-20 items-center rounded-lg border border-dashed border-white/10 px-4 text-sm text-white/40">
                  첨부한 이미지가 여기에 표시됩니다.
                </div>
              )}
            </section>

            <section>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                Colors
              </div>
              <div className="grid grid-cols-7 gap-2 sm:max-w-[560px]">
                {POST_BACKGROUND_COLORS.map((color) => {
                  const next = { type: "color", value: color.value } as const;
                  return (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setDraftSelection(next)}
                      className={`${optionClass(next)} aspect-square`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    >
                      {isActive(next) && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                          <Check size={13} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <div className="mb-3 text-xs font-medium uppercase tracking-[0.16em] text-white/38">
                Basic Images
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {POST_BASIC_IMAGES.map((image) => {
                  const next = { type: "asset", value: image.path } as const;
                  return (
                    <button
                      key={image.path}
                      type="button"
                      onClick={() => setDraftSelection(next)}
                      className={`${optionClass(next)} aspect-[16/10] bg-white/[0.03]`}
                      title={image.label}
                    >
                      <div
                        className="h-full w-full bg-cover bg-center"
                        style={{ backgroundImage: `url(${getImage("assets", image.path)})` }}
                      />
                      {isActive(next) && (
                        <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black">
                          <Check size={13} aria-hidden="true" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            <button
              type="button"
              onClick={() => setDraftSelection(emptySelection)}
              className="text-sm text-white/45 underline-offset-4 transition hover:text-white/75 hover:underline"
            >
              배경 선택 해제
            </button>
          </div>

          <div className="flex min-h-0 flex-col justify-center overflow-y-auto bg-white/[0.012] p-5 sm:p-6">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-white/38">
              Preview
            </div>
            <div className="relative mt-5 w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_24px_80px_rgba(0,0,0,0.46)]">
              {preview.imageUrl ? (
                <div className="absolute inset-0">
                  <img src={preview.imageUrl} alt="" className="h-full w-full object-cover opacity-60" />
                  <div className="absolute inset-0 bg-black/55" />
                  <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40" />
                </div>
              ) : preview.color ? (
                <div className="absolute inset-0" style={{ backgroundColor: preview.color }}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
                </div>
              ) : (
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
              )}

              <div className="relative flex min-h-[220px] flex-col px-5 pt-5 pb-4">
                <div className="mb-4 flex items-center justify-between gap-2 text-[13px] text-white/60">
                  <span className="inline-flex h-6 min-w-0 items-center gap-3">
                    <ProfileAvatar
                      imagePath={profileImagePath}
                      className="h-6 w-6 shrink-0 ring-1 ring-white/10"
                      sizes="24px"
                    />
                    <span className="truncate leading-none">{nickname}</span>
                  </span>
                  <span className="flex h-6 shrink-0 items-center leading-none">
                    {previewDate}
                  </span>
                </div>

                <div className="flex-1 overflow-hidden">
                  <div className="mb-3 line-clamp-1 text-base font-semibold text-white/90">
                    {previewTitle}
                  </div>
                  <div className="line-clamp-2 text-sm leading-relaxed text-white/70">
                    {excerpt.slice(0, 120)}
                  </div>
                </div>

                <div className="mt-auto pt-5">
                  <div className="mb-4 h-px bg-white/7" />
                  <div className="flex items-center gap-4 text-[13px] text-white/60">
                    <div className="flex items-center gap-1.5">
                      <Heart size={17} className="relative top-[0.5px] text-white/55" />
                      <span className="leading-none">0</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <MessageCircle size={17} className="relative top-[0.5px] text-white/55" />
                      <span className="leading-none">0</span>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5 pr-[2px]">
                      <Eye size={17} className="relative top-[0.5px] text-white/55" />
                      <span className="leading-none">0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4 border-y border-white/8 py-4">
              <div>
                <div className="text-xs text-white/35">Selected</div>
                <div className="mt-1 max-w-[320px] truncate text-sm text-white/76">
                  {selectedLabel}
                </div>
              </div>
              <div
                className="h-8 w-8 shrink-0 rounded-full border border-white/12 bg-white/[0.04] bg-cover bg-center"
                style={selectedSwatchStyle}
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-xl px-4 text-sm text-white/58 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white/80"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => onConfirm(draftSelection)}
                className="h-10 rounded-xl bg-white px-4 text-sm font-medium text-black transition hover:bg-white/85"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
