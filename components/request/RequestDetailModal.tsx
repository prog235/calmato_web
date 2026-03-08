import { useEffect } from "react";

export type RequestItem = {
  id: number;
  title: string;
  subtitle: string;
  content: string | null;
  like_count: number;
  created_at?: string;
};

type RequestDetailModalProps = {
  open: boolean;
  request: RequestItem | null;
  onClose: () => void;
};

export default function RequestDetailModal({
  open,
  request,
  onClose,
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
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-neutral-500">
              Song Request
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-white">{request.title}</h2>
            <p className="mt-2 text-base text-neutral-300">{request.subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-white/10 bg-neutral-900/70 p-4">
            <p className="mb-2 text-sm font-medium text-neutral-400">요청사항</p>
            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-neutral-200">
              {request.content?.trim()
                ? request.content
                : "등록된 요청사항이 없습니다."}
            </p>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3">
            <span className="text-sm text-neutral-400">추천 수</span>
            <span className="text-sm font-semibold text-white">
              ❤️ {request.like_count}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}