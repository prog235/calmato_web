import { useEffect } from "react";
import { Heart, Pencil, Trash2, X } from "lucide-react";
import { FaUser } from "react-icons/fa6";

export type RequestDetailItem = {
  id: number;
  title: string;
  subtitle: string;
  content: string | null;
  like_count: number;
  nickname: string;
  created_at?: string;
};

type RequestDetailModalProps = {
  open: boolean;
  request: RequestDetailItem | null;
  liked: boolean;
  busy: boolean;
  onToggleLike: (requestId: number) => Promise<void>;
  onClose: () => void;
  showLikeAction?: boolean;
  isOwn?: boolean;
  actionBusy?: boolean;
  onEdit?: (request: RequestDetailItem) => void;
  onDelete?: (request: RequestDetailItem) => Promise<void>;
};

export default function RequestDetailModal({
  open,
  request,
  liked,
  busy,
  onToggleLike,
  onClose,
  showLikeAction = true,
  isOwn = false,
  actionBusy = false,
  onEdit,
  onDelete,
}: RequestDetailModalProps) {
  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    if (open) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !request) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/72 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/14 bg-[#111214]/95 p-6 shadow-[0_24px_72px_rgba(0,0,0,0.65)] sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(circle at 16% 10%, rgba(211,166,88,0.10), transparent 34%), radial-gradient(circle at 80% 0%, rgba(255,255,255,0.055), transparent 30%)",
          }}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white/58 transition hover:bg-white/8 hover:text-white"
          aria-label="닫기"
        >
          <X size={22} strokeWidth={1.7} />
        </button>

        <div className="relative mb-7">
          <p className="text-xs uppercase tracking-[0.34em] text-[#d2a65d]">
            SONG REQUEST
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
            {request.title}
          </h2>
          <div className="mt-3 flex items-center justify-between gap-5">
            <p className="min-w-0 truncate text-base leading-relaxed text-white/58">
              {request.subtitle}
            </p>
            <span className="inline-flex shrink-0 items-center gap-2 text-sm text-white/62">
              <FaUser size={11} className="text-white/38" aria-hidden="true" />
              <span>{request.nickname}</span>
            </span>
          </div>
          <div className="mt-4 h-px w-full bg-white/12" />
        </div>

        <div className="relative space-y-4">
          <section>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-white/72">
              {request.content?.trim()
                ? request.content
                : "등록된 요청사항이 없습니다."}
            </p>
          </section>

          <div className="flex flex-wrap items-center gap-4">
            {isOwn ? (
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => onEdit?.(request)}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/58 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Pencil size={14} strokeWidth={1.8} />
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete?.(request)}
                  disabled={actionBusy}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-white/58 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 size={14} strokeWidth={1.8} />
                  삭제
                </button>
              </div>
            ) : null}
            <div className="h-px flex-1 bg-white/12" />
            {showLikeAction ? (
              <button
                type="button"
                onClick={() => void onToggleLike(request.id)}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-2 text-base font-semibold text-white/86 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={liked ? "좋아요 취소" : "좋아요"}
              >
                <Heart
                  size={20}
                  className={
                    liked
                      ? "fill-red-500 text-red-500"
                      : "text-red-400 transition hover:fill-red-500 hover:text-red-500"
                  }
                />
                {request.like_count.toLocaleString()}
              </button>
            ) : (
              <span className="inline-flex shrink-0 items-center gap-2 text-base font-semibold text-white/70">
                <Heart size={20} className="text-red-400" />
                {request.like_count.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
