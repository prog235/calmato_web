import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useMemo, useState } from "react";
import { Mail, X } from "lucide-react";

import { getImage } from "@/lib/getUrl";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_VIDEO_SRC = getImage("assets", "login_vid.mp4");

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const canSubmit = useMemo(() => {
    return isValidEmail(email.trim()) && !loading;
  }, [email, loading]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    const nextEmail = email.trim();
    if (!isValidEmail(nextEmail)) {
      setErrorText("올바른 이메일을 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const { error } = await supabase.auth.resetPasswordForEmail(nextEmail, {
        redirectTo: `${origin}/reset-password`,
      });

      if (error) throw error;

      setSuccessText("비밀번호 재설정 링크를 이메일로 보냈습니다.");
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "비밀번호 재설정 메일 발송에 실패했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Forgot Password | Calmato</title>
      </Head>

      <main className="min-h-screen overflow-hidden bg-[#0a0a0a]">
        <section className="grid min-h-screen px-5 py-6 md:grid-cols-2 md:px-6 lg:gap-14">
          <div className="hidden min-h-[calc(100vh-3rem)] md:block">
            <div className="relative h-full overflow-hidden rounded-[20px] border border-white/8 bg-white/[0.025]">
              <video
                src={LOGIN_VIDEO_SRC}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-black/18" />
            </div>
          </div>

          <div className="relative flex min-h-[calc(100vh-3rem)] items-center justify-center px-0 py-12 md:px-8 lg:px-12">
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white md:right-1 md:top-1"
              aria-label="닫기"
            >
              <X size={18} strokeWidth={1.8} />
            </button>

            <div className="w-full max-w-[430px]">
              <h1 className="font-serif text-[36px] font-medium leading-none tracking-normal text-white">
                Calmato
              </h1>

              <p className="mt-6 text-base font-medium text-white/88">
                함께하는 순간이 서로의 위로가 되기를
              </p>

              <form onSubmit={onSubmit} className="mt-10 space-y-5">
                <div className="border-b border-white/14 pb-3">
                  <label className="flex items-center gap-2 text-sm text-white/42">
                    <Mail size={16} strokeWidth={1.7} className="text-white/88" />
                    <span>
                      이메일<span className="ml-0.5 text-[#ff8b32]">*</span>
                    </span>
                  </label>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    type="email"
                    autoComplete="email"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="이메일"
                  />
                </div>

                {errorText ? (
                  <p className="-mt-3 text-xs text-red-300">{errorText}</p>
                ) : successText ? (
                  <p className="-mt-3 text-xs text-emerald-300">{successText}</p>
                ) : null}

                <div className="space-y-4 pt-1">
                  <p className="text-xs text-white/42">
                    계정이 기억나셨나요?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-white/82 transition hover:text-white"
                    >
                      로그인
                    </Link>
                  </p>
                  <p className="text-xs leading-5 text-white/38">
                    가입한 이메일이 기억나지 않는다면 Google/Kakao 로그인을 먼저
                    시도해보세요. 그래도 찾기 어렵다면{" "}
                    <Link
                      href="/contact"
                      className="font-medium text-white/78 transition hover:text-white"
                    >
                      Contact
                    </Link>
                    로 문의해주세요.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 h-11 w-full rounded-full bg-white/20 text-sm font-medium text-white/45 transition hover:bg-white/24 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "메일 발송 중..." : "재설정 링크 받기"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
