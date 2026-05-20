import { useRouter } from "next/router";
import { useEffect } from "react";

type LoginRequiredModalProps = {
  open: boolean;
  onClose: () => void;
  nextPath?: string;
  exploreHref?: string;
};

export default function LoginRequiredModal({
  open,
  onClose,
  nextPath,
  exploreHref,
}: LoginRequiredModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;

    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleLogin = () => {
    const next = nextPath ?? router.asPath;
    void router.push(`/login?next=${encodeURIComponent(next)}`);
  };

  const handleExplore = () => {
    if (exploreHref) {
      void router.push(exploreHref);
      return;
    }

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="login-required-title"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950 p-6 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="login-required-title" className="text-md font-semibold text-white">
          로그인이 필요한 기능입니다.
        </h2>
        <p className="mt-3 text-xs leading-6 text-neutral-300">
          로그인 이후 마음을 남기실 수 있어요. 로그인 하시겠어요?
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={handleLogin}
            className="cursor-pointer rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            로그인하기
          </button>
          <button
            type="button"
            onClick={handleExplore}
            className="cursor-pointer rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-white/5 hover:text-white"
          >
            조금 더 둘러보기
          </button>
        </div>
      </div>
    </div>
  );
}
