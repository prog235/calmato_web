import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { useMemo, useState } from "react";
import { Eye, EyeOff, LockKeyhole, Mail, UserRound, X } from "lucide-react";

import { getImage } from "@/lib/getUrl";
import { validateNickname } from "@/lib/validateNickname";
import { supabase } from "@/lib/supabaseClient";

const LOGIN_VIDEO_SRC = getImage("assets", "login_vid.mp4");

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
  const [showPassword, setShowPassword] = useState(false);

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
              onClick={() => router.push("/")}
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
                    <UserRound size={16} strokeWidth={1.7} className="text-white/88" />
                    <span>
                      닉네임<span className="ml-0.5 text-[#ff8b32]">*</span>
                    </span>
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
                    type="text"
                    autoComplete="nickname"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="닉네임"
                  />
                </div>

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
                    onChange={(e) => {
                      const value = e.target.value;
                      setPassword(value);

                      if (passwordConfirm && value !== passwordConfirm) {
                        setPasswordMatchError("비밀번호가 일치하지 않습니다.");
                      } else {
                        setPasswordMatchError("");
                      }
                    }}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="비밀번호"
                  />
                </div>

                <div className="border-b border-white/14 pb-3">
                  <label className="flex items-center gap-2 text-sm text-white/42">
                    <LockKeyhole size={16} strokeWidth={1.7} className="text-white/88" />
                    <span>
                      비밀번호 확인<span className="ml-0.5 text-[#ff8b32]">*</span>
                    </span>
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
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    className="mt-2 h-6 w-full bg-transparent text-sm text-white/90 outline-none placeholder:text-white/25"
                    aria-label="비밀번호 확인"
                  />
                </div>

                {nicknameError ? (
                  <p className="-mt-3 text-xs text-red-300">{nicknameError}</p>
                ) : passwordMatchError ? (
                  <p className="-mt-3 text-xs text-red-300">{passwordMatchError}</p>
                ) : errorText ? (
                  <p className="-mt-3 text-xs text-red-300">{errorText}</p>
                ) : successText ? (
                  <p className="-mt-3 text-xs text-emerald-300">{successText}</p>
                ) : null}

                <div className="space-y-4 pt-1">
                  <p className="text-xs text-white/42">
                    이미 계정이 있으신가요?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-white/82 transition hover:text-white"
                    >
                      로그인
                    </Link>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="mt-1 h-11 w-full rounded-full bg-white/20 text-sm font-medium text-white/45 transition hover:bg-white/24 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {status === "loading" ? "가입 처리 중..." : "회원가입"}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
