import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";

import { supabase } from "@/lib/supabaseClient";

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

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0 && !loading;
  }, [email, password, loading]);

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

      await router.replace("/profile");
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
          redirectTo: `${origin}/profile`,
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

      <main className="relative min-h-screen overflow-hidden">
        {/* left-bottom warm glow like the screenshot */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -bottom-36 h-[560px] w-[560px] rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,200,110,0.35), rgba(255,200,110,0) 62%)",
          }}
        />

        {/* Center Card */}
        <section className="mx-auto grid min-h-screen max-w-[1100px] place-items-center px-4 py-16">
          <div className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h1 className="text-center text-[22px] font-semibold tracking-tight">
              로그인
            </h1>
            <p className="subtext mt-2 text-center text-sm">
              함께하는 순간이 서로의 위로가 되기를
            </p>

            <div className="mt-6 space-y-3">
              <button
                type="button"
                onClick={() => signInWithOAuth("apple")}
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/90 px-4 text-sm text-black transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden className="text-lg leading-none">
                  
                </span>
                <span>Apple계정으로 계속하기</span>
              </button>

              <button
                type="button"
                onClick={() => signInWithOAuth("google")}
                disabled={loading}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/90 px-4 text-sm text-black transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span aria-hidden className="font-semibold leading-none">
                  G
                </span>
                <span>Google계정으로 계속하기</span>
              </button>
            </div>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="subtext text-xs">또는</span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="subtext text-xs">
                  이메일<span className="ml-0.5 text-red-300">*</span>
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="이메일"
                  type="email"
                  autoComplete="email"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/5"
                />
              </div>

              <div className="space-y-2">
                <label className="subtext text-xs">
                  비밀번호<span className="ml-0.5 text-red-300">*</span>
                </label>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  type="password"
                  autoComplete="current-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/5"
                />

                {/* Requirement: error under password field */}
                {errorText ? (
                  <p className="mt-1 text-xs text-red-300">{errorText}</p>
                ) : (
                  <div className="h-4" />
                )}
              </div>

              <div className="flex items-center justify-start">
                <Link
                  href="/forgot-password"
                  className="subtext text-xs hover:text-[color:var(--foreground)]"
                >
                  비밀번호를 잊으셨나요?
                </Link>
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="h-11 w-full rounded-full border border-white/10 bg-white/10 text-sm text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>

              <p className="subtext pt-2 text-center text-xs">
                아직 계정이 없으신가요?{" "}
                <Link
                  href="/signup"
                  className="text-white/85 hover:text-white"
                >
                  회원가입
                </Link>
              </p>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
