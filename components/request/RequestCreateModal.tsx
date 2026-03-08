import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type RequestCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

export default function RequestCreateModal({
  open,
  onClose,
  onCreated,
}: RequestCreateModalProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      setTitle("");
      setSubtitle("");
      setContent("");
      setSubmitting(false);
      setErrorMessage("");
    }
  }, [open]);

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

  if (!open) return null;

  const isValid = title.trim().length > 0 && subtitle.trim().length > 0;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!isValid) {
      setErrorMessage("제목과 부제목은 필수입니다.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");

      const { error } = await supabase.from("requests").insert({
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: content.trim() === "" ? null : content.trim(),
      });

      if (error) {
        throw error;
      }

      onClose();
      onCreated?.();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "곡 신청 등록 중 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

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
            <h2 className="text-2xl font-semibold text-white">Request a Song</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Calmato에서 듣고 싶은 곡을 남겨주세요.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm text-neutral-300 transition hover:bg-white/10 hover:text-white"
          >
            닫기
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              제목 <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Spirited Away OST"
              className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 outline-none transition focus:border-white/30"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              부제목 (영화 제목 / 가수) <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="예: Joe Hisaishi / Spirited Away"
              className="w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 outline-none transition focus:border-white/30"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">
              요청사항 <span className="text-neutral-500">(선택)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="어떤 분위기로 듣고 싶은지, 어떤 장면이 떠오르는지 자유롭게 적어주세요."
              rows={6}
              className="w-full resize-none rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white placeholder:text-neutral-500 outline-none transition focus:border-white/30"
              maxLength={1000}
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-400">{errorMessage}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={submitting || !isValid}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "등록 중..." : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}