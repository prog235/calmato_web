import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";

import { supabase } from "@/lib/supabaseClient";

export type CreatedRequestRow = {
  id: number;
  user_id: string;
  title: string;
  subtitle: string | null;
  content: string | null;
  created_at: string;
  upload_date: string | null;
  like_count: number | null;
};

type RequestCreateModalProps = {
  open: boolean;
  onClose: () => void;
  initialRequest?: CreatedRequestRow | null;
  onCreated?: (created: CreatedRequestRow) => void | Promise<void>;
  onUpdated?: (updated: CreatedRequestRow) => void | Promise<void>;
};

export default function RequestCreateModal({
  open,
  onClose,
  initialRequest = null,
  onCreated,
  onUpdated,
}: RequestCreateModalProps) {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const isEditMode = Boolean(initialRequest);

  useEffect(() => {
    if (open && initialRequest) {
      setTitle(initialRequest.title ?? "");
      setSubtitle(initialRequest.subtitle ?? "");
      setContent(initialRequest.content ?? "");
      setSubmitting(false);
      setErrorMessage("");
      return;
    }

    if (open) {
      setTitle("");
      setSubtitle("");
      setContent("");
      setSubmitting(false);
      setErrorMessage("");
    }
  }, [initialRequest, open]);

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

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: content.trim() === "" ? null : content.trim(),
      };

      const { data, error } = initialRequest
        ? await supabase
            .from("requests")
            .update(payload)
            .eq("id", initialRequest.id)
            .eq("user_id", initialRequest.user_id)
            .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
            .single()
        : await supabase
            .from("requests")
            .insert(payload)
            .select("id, user_id, title, subtitle, content, created_at, upload_date, like_count")
            .single();

      if (error) {
        throw error;
      }

      if (!data) {
        throw new Error(
          initialRequest
            ? "수정된 요청 데이터를 불러오지 못했습니다."
            : "생성된 요청 데이터를 불러오지 못했습니다."
        );
      }

      if (initialRequest) {
        await onUpdated?.(data as CreatedRequestRow);
      } else {
        await onCreated?.(data as CreatedRequestRow);
      }
      onClose();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : initialRequest
            ? "곡 신청 수정 중 오류가 발생했습니다."
            : "곡 신청 등록 중 오류가 발생했습니다.";
      setErrorMessage(message);
    } finally {
      setSubmitting(false);
    }
  }

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

        <div className="relative mb-5">
          <p className="text-xs uppercase tracking-[0.34em] text-[#d2a65d]">
            SONG REQUEST
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
            {isEditMode ? "Edit Request" : "Request a Song"}
          </h2>
          <p className="mt-3 text-md leading-relaxed text-white/58">
            {isEditMode
              ? "신청한 곡 정보를 수정해주세요."
              : "Calmato에서 듣고 싶은 곡을 남겨주세요."}
          </p>
          <div className="mt-4 h-px w-full bg-white/12" />
        </div>

        <form onSubmit={handleSubmit} className="relative space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              곡 제목 <span className="text-[#d2a65d]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: Spirited Away OST"
              className="w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#d2a65d]/55"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              영화 / 가수 / 작곡가 <span className="text-[#d2a65d]">*</span>
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="예: Joe Hisaishi / Spirited Away"
              className="w-full border-0 border-b border-white/12 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#d2a65d]/55"
              maxLength={120}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white/70">
              요청사항 <span className="text-white/38">(선택)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="어떤 분위기로 듣고 싶은지 자유롭게 적어주세요."
              rows={6}
              className="w-full resize-none border-0 border-b border-white/12 bg-transparent px-0 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-[#d2a65d]/55"
              maxLength={1000}
            />
          </div>

          {errorMessage ? (
            <p className="text-sm text-red-400">{errorMessage}</p>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-white/62 transition hover:bg-white/6 hover:text-white"
            >
              취소
            </button>

            <button
              type="submit"
              disabled={submitting || !isValid}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? isEditMode
                  ? "수정 중..."
                  : "등록 중..."
                : isEditMode
                  ? "수정하기"
                  : "등록하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
