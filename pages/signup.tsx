import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { validateNickname } from "@/lib/validateNickname";
import { supabase } from "@/lib/supabaseClient";

type UiStatus = "idle" | "loading" | "success";

function isValidEmail(email: string) {
  // Enough for UI validation (Supabase will validate server-side as well)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SignupPage() {
  const router = useRouter();

  const [nickname, setNickname] = useState("");
  const [nicknameError, setNicknameError] = useState<string>("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  const [passwordMatchError, setPasswordMatchError] = useState<string>("");

  const [status, setStatus] = useState<UiStatus>("idle");
  const [errorText, setErrorText] = useState("");
  const [successText, setSuccessText] = useState("");

  const canSubmit = useMemo(() => {
    if (status === "loading") return false;
    if (!nickname.trim()) return false;
    if (!email.trim() || !isValidEmail(email.trim())) return false;
    if (password.length < 8) return false;
    if (password !== passwordConfirm) return false;
    return true;
  }, [nickname, email, password, passwordConfirm, status]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText("");
    setSuccessText("");

    const n = nickname.trim();
    const em = email.trim();

    const nicknameCheck = validateNickname(n);
    if (!nicknameCheck.valid) {
      setErrorText(nicknameCheck.message);
      return;
    }

    if (!n) {
      setErrorText("닉네임을 입력해주세요.");
      return;
    }
    if (!em || !isValidEmail(em)) {
      setErrorText("올바른 이메일을 입력해주세요.");
      return;
    }
    if (password.length < 8) {
      setErrorText("비밀번호는 8자 이상이어야 합니다.");
      return;
    }
    if (password !== passwordConfirm) {
      setErrorText("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    try {
      setStatus("loading");

      const origin = typeof window !== "undefined" ? window.location.origin : "";

      // 1) Supabase Auth sign up
      // IMPORTANT:
      // - profiles.insert는 하지 않습니다. (RLS로 막히는 것이 정상)
      // - nickname은 auth.users.user_metadata에 넣고, DB 트리거가 profiles를 생성합니다.
      const { error } = await supabase.auth.signUp({
        email: em,
        password,
        options: {
          emailRedirectTo: `${origin}/login`,
          data: {
            nickname: n,
          },
        },
      });

      if (error) {
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("already registered")) {
          setErrorText("이미 가입된 이메일입니다. 로그인 페이지에서 로그인해주세요.");
        } else if (msg.includes("password") && msg.includes("weak")) {
          setErrorText("비밀번호가 너무 약합니다. 더 강한 비밀번호로 설정해주세요.");
        } else {
          setErrorText("회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
        }
        setStatus("idle");
        return;
      }

      // 2) UX: show success text then redirect to login
      setStatus("success");
      setSuccessText("회원가입이 완료되었습니다. 이메일 인증을 진행한 뒤 로그인해주세요.");

      setTimeout(() => {
        router.push("/login?signup=success");
      }, 900);
    } catch {
      setErrorText("회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.");
      setStatus("idle");
    }
  };

  return (
    <>
      <Head>
        <title>Sign Up | Calmato</title>
      </Head>

      <main className="relative min-h-screen overflow-hidden">
        {/* warm glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute -left-32 -bottom-36 h-[560px] w-[560px] rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(255,200,110,0.35), rgba(255,200,110,0) 62%)",
          }}
        />

        <section className="mx-auto grid min-h-screen max-w-[1100px] place-items-center px-4 py-16">
          <div className="w-full max-w-[520px] rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-md">
            <h1 className="text-center text-[22px] font-semibold tracking-tight">회원가입</h1>
            <p className="subtext mt-2 text-center text-sm">
              함께하는 순간이 서로의 위로가 되기를
            </p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="subtext text-xs">
                  닉네임<span className="ml-0.5 text-red-300">*</span>
                </label>
                <input
                  value={nickname}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNickname(value);

                    const result = validateNickname(value);
                    if (!result.valid) {
                      setNicknameError(result.message);
                    } else {
                      setNicknameError("");
                    }
                  }}
                  placeholder="닉네임"
                  type="text"
                  autoComplete="nickname"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/5"
                />
                <p className={`text-xs ${nicknameError ? "text-red-300" : "subtext"}`}>
                  {nicknameError
                    ? nicknameError
                    : "닉네임은 커뮤니티에서 표시되는 이름입니다. (나중에 변경 가능)"}
                </p>
              </div>

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
                <p className="subtext text-xs">회원가입 후 이메일 인증 링크가 발송됩니다.</p>
              </div>

              <div className="space-y-2">
                <label className="subtext text-xs">
                  비밀번호<span className="ml-0.5 text-red-300">*</span>
                </label>
                <input
                  value={password}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPassword(value);

                    if (passwordConfirm && value !== passwordConfirm) {
                      setPasswordMatchError("비밀번호가 일치하지 않습니다.");
                    } else {
                      setPasswordMatchError("");
                    }
                  }}
                  placeholder="비밀번호 (8자 이상)"
                  type="password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/5"
                />
              </div>

              <div className="space-y-2">
                <label className="subtext text-xs">
                  비밀번호 확인<span className="ml-0.5 text-red-300">*</span>
                </label>
                <input
                  value={passwordConfirm}
                  onChange={(e) => {
                    const value = e.target.value;
                    setPasswordConfirm(value);

                    if (password && value !== password) {
                      setPasswordMatchError("비밀번호가 일치하지 않습니다.");
                    } else {
                      setPasswordMatchError("");
                    }
                  }}
                  placeholder="비밀번호 확인"
                  type="password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-sm text-[color:var(--foreground)] outline-none transition focus:border-white/20 focus:ring-4 focus:ring-white/5"
                />

                {/* messages under password-confirm area (same pattern as login) */}
                {passwordMatchError ? (
                  <p className="mt-1 text-xs text-red-300">{passwordMatchError}</p>
                ) : errorText ? (
                  <p className="mt-1 text-xs text-red-300">{errorText}</p>
                ) : successText ? (
                  <p className="mt-1 text-xs text-emerald-300">{successText}</p>
                ) : (
                  <div className="h-4" />
                )}
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="h-11 w-full rounded-full border border-white/10 bg-white/10 text-sm text-white/80 transition hover:bg-white/15 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "loading" ? "가입 처리 중..." : "회원가입"}
              </button>

              <p className="subtext pt-2 text-center text-xs">
                이미 계정이 있으신가요?{" "}
                <Link href="/login" className="text-white/85 hover:text-white">
                  로그인
                </Link>
              </p>
            </form>
          </div>
        </section>
      </main>
    </>
  );
}
