import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, X } from "lucide-react";

import { getImage } from "@/lib/getUrl";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_VIDEO_SRC = getImage("assets", "login_vid.mp4");

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const canSubmit = useMemo(() => {
    return password.length >= 8 && password === passwordConfirm && ready && !loading;
  }, [loading, password, passwordConfirm, ready]);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setReady(Boolean(session));
      if (!session) {
        setErrorText("재설정 링크가 만료되었거나 유효하지 않습니다.");
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
        setErrorText("");
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorText("");
    setSuccessText("");

    if (password.length < 8) {
      setErrorText("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    if (password !== passwordConfirm) {
      setErrorText("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccessText("비밀번호가 변경되었습니다. 다시 로그인해주세요.");
      await supabase.auth.signOut();

      window.setTimeout(() => {
        void router.push("/login");
      }, 900);
    } catch (error) {
      setErrorText(
        error instanceof Error
          ? error.message
          : "비밀번호 변경 중 오류가 발생했습니다."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Head>
        <title>Reset Password | Calmato</title>
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
                  <div className="flex items-center gap-3">
                    <label className="flex flex-1 items-center gap-2 text-sm text-white/42">
                      <LockKeyhole size={16} strokeWidth={1.7} className="text-white/88" />
                      <span>
                        새 비밀번호<span className="ml-0.5 text-[#ff8b32]">*</span>
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="inline-flex h-8 w-8 items-center justify-center text-white/70 transition hover:text-white"
                      aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                    >
                      {showPassword ? (
                        <EyeOff size={17} strokeWidth={1.8} />
                      ) : (
                        <Eye size={17} strokeWidth={1.8} />
                      )}
                    </button>
                  </div>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="새 비밀번호"
                  />
                </div>

                <div className="border-b border-white/14 pb-3">
                  <label className="flex items-center gap-2 text-sm text-white/42">
                    <LockKeyhole size={16} strokeWidth={1.7} className="text-white/88" />
                    <span>
                      새 비밀번호 확인<span className="ml-0.5 text-[#ff8b32]">*</span>
                    </span>
                  </label>
                  <input
                    value={passwordConfirm}
                    onChange={(event) => setPasswordConfirm(event.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="새 비밀번호 확인"
                  />
                </div>

                {errorText ? (
                  <p className="-mt-3 text-xs text-red-300">{errorText}</p>
                ) : successText ? (
                  <p className="-mt-3 text-xs text-emerald-300">{successText}</p>
                ) : passwordConfirm && password !== passwordConfirm ? (
                  <p className="-mt-3 text-xs text-red-300">
                    비밀번호가 일치하지 않습니다.
                  </p>
                ) : null}

                <div className="space-y-4 pt-1">
                  <p className="text-xs text-white/42">
                    재설정 메일이 필요하신가요?{" "}
                    <Link
                      href="/forgot-password"
                      className="font-medium text-white/82 transition hover:text-white"
                    >
                      다시 받기
                    </Link>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 h-11 w-full rounded-full bg-white/20 text-sm font-medium text-white/45 transition hover:bg-white/24 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "변경 중..." : "비밀번호 변경"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
