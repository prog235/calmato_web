import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, X } from "lucide-react";

import { getImage } from "@/lib/getUrl";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_VIDEO_SRC = getImage("assets", "login_vid.mp4");

type AuthErrorCode =
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "unknown";

function normalizeAuthError(message?: string): AuthErrorCode {
  const m = (message ?? "").toLowerCase();

  if (m.includes("invalid login credentials")) return "invalid_credentials";
  if (m.includes("email not confirmed")) return "email_not_confirmed";
  if (m.includes("rate limit") || m.includes("too many requests")) return "rate_limited";

  return "unknown";
}

function getSafeNextPath(next: string | string[] | undefined) {
  const raw = Array.isArray(next) ? next[0] : next;

  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/";
  }

  if (raw.startsWith("/login")) {
    return "/";
  }

  return raw;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

  const nextPath = useMemo(
    () => getSafeNextPath(router.query.next),
    [router.query.next]
  );

  useEffect(() => {
    if (!router.isReady) return;

    let cancelled = false;

    async function redirectIfAlreadyLoggedIn() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled && session) {
        await router.replace(nextPath);
      }
    }

    void redirectIfAlreadyLoggedIn();

    return () => {
      cancelled = true;
    };
  }, [nextPath, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");

    if (!email.trim() || !password.trim()) {
      setErrorText("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log("signInWithPassword result:", { data, error });

      if (error) {
        const code = normalizeAuthError(error.message);

        if (code === "invalid_credentials") {
          setErrorText("아이디 / 비밀번호를 확인해주세요.");
        } else if (code === "email_not_confirmed") {
          setErrorText("이메일 인증이 완료되지 않았습니다. 메일함을 확인해주세요.");
        } else if (code === "rate_limited") {
          setErrorText("요청이 너무 많습니다. 잠시 후 다시 시도해주세요.");
        } else {
          setErrorText(error.message || "로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
        return;
      }

      // 세션이 바로 안 잡히는 케이스 대비: 한 번 더 확인
      const { data: sessionRes, error: sessionErr } = await supabase.auth.getSession();
      console.log("getSession after login:", { sessionRes, sessionErr });

      if (sessionErr || !sessionRes.session) {
        setErrorText("로그인 세션을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.");
        return;
      }

      await router.replace(nextPath);
    } catch (err) {
      console.error("login unexpected error:", err);
      setErrorText("로그인 중 오류가 발생했습니다. 콘솔 로그를 확인해주세요.");
    } finally {
      setLoading(false);
    }
  };


  const signInWithOAuth = async (provider: "google" | "apple") => {
    setErrorText("");
    setLoading(true);

    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${origin}/login?next=${encodeURIComponent(nextPath)}`,
        },
      });

      if (error) {
        setErrorText("소셜 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Login | Calmato</title>
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
              onClick={() => router.push(nextPath)}
              className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white md:right-1 md:top-1"
              aria-label="닫기"
            >
              <X size={18} strokeWidth={1.8} />
            </button>

            <div className="w-full max-w-[430px]">
              <h1 className="font-serif text-[36px] font-medium leading-none tracking-normal text-white">
                Calmato
              </h1>

              <p className="mt-14 text-base font-medium text-white/88">
                함께하는 순간이 서로의 위로가 되기를
              </p>

              <form onSubmit={onSubmit} className="mt-7 space-y-5">
                <div className="border-b border-white/14 pb-3">
                  <label className="flex items-center gap-2 text-sm text-white/42">
                    <Mail size={16} strokeWidth={1.7} className="text-white/88" />
                    <span>
                      이메일<span className="ml-0.5 text-[#ff8b32]">*</span>
                    </span>
                  </label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="이메일"
                  />
                </div>

                <div className="border-b border-white/14 pb-3">
                  <div className="flex items-center gap-3">
                    <label className="flex flex-1 items-center gap-2 text-sm text-white/42">
                      <LockKeyhole size={16} strokeWidth={1.7} className="text-white/88" />
                      <span>
                        비밀번호<span className="ml-0.5 text-[#ff8b32]">*</span>
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
                    onChange={(e) => setPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="비밀번호"
                  />
                </div>

                {errorText ? (
                  <p className="-mt-3 text-xs text-red-300">{errorText}</p>
                ) : null}

                <div className="space-y-4 pt-1">
                  <Link
                    href="/forgot-password"
                    className="block text-xs font-medium text-white/78 transition hover:text-white"
                  >
                    비밀번호를 잊으셨나요?
                  </Link>
                  <p className="text-xs text-white/42">
                    아직 계정이 없으신가요?{" "}
                    <Link
                      href="/signup"
                      className="font-medium text-white/82 transition hover:text-white"
                    >
                      회원가입
                    </Link>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 h-11 w-full rounded-full bg-white/20 text-sm font-medium text-white/45 transition hover:bg-white/24 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? "로그인 중..." : "로그인"}
                </button>
              </form>

              <div className="my-7 flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs text-white/55">또는</span>
                <div className="h-px flex-1 bg-white/10" />
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => signInWithOAuth("apple")}
                  disabled={loading}
                  className="flex h-[38px] w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-medium text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden className="text-xl leading-none">
                    
                  </span>
                  <span>Apple계정으로 계속하기</span>
                </button>

                <button
                  type="button"
                  onClick={() => signInWithOAuth("google")}
                  disabled={loading}
                  className="flex h-[38px] w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-medium text-black transition hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span aria-hidden className="text-base font-bold leading-none text-[#4285f4]">
                    G
                  </span>
                  <span>Google계정으로 계속하기</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
