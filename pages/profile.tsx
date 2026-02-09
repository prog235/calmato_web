// pages/profile.tsx
import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabaseClient";
import { validateNickname } from "@/lib/validateNickname";

type UiStatus = "idle" | "saving" | "success" | "error";

type DupState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "error"; message: string };

type PageState =
  | { state: "loading" }
  | { state: "ready"; userId: string; email: string; nickname: string }
  | { state: "error"; message: string };

export default function ProfilePage() {
  const router = useRouter();

  const [page, setPage] = useState<PageState>({ state: "loading" });

  const [currentNickname, setCurrentNickname] = useState("");
  const [nextNickname, setNextNickname] = useState("");

  const [status, setStatus] = useState<UiStatus>("idle");
  const [message, setMessage] = useState("");

  const [dup, setDup] = useState<DupState>({ state: "idle" });

  const validation = useMemo(
    () => validateNickname(nextNickname),
    [nextNickname]
  );

  const reqTokenRef = useRef(0);

  /**
   * 1) CSR auth guard + initial profile load
   */
  useEffect(() => {
    let cancelled = false;

    async function boot() {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const user = userRes?.user;

        if (!user) {
          router.replace("/login");
          return;
        }

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("id, nickname")
          .eq("id", user.id)
          .single();

        if (cancelled) return;

        setPage({
          state: "ready",
          userId: user.id,
          email: user.email ?? "",
          nickname: profile?.nickname ?? "",
        });

        setCurrentNickname(profile?.nickname ?? "");
        setNextNickname(profile?.nickname ?? "");
      } catch (e) {
        if (cancelled) return;
        setPage({
          state: "error",
          message:
            e instanceof Error
              ? e.message
              : "프로필을 불러오지 못했습니다.",
        });
      }
    }

    boot();

    // 다른 탭에서 로그아웃된 경우 대응
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  /**
   * 닉네임 중복 체크
   */
  async function checkNicknameExists(
    userId: string,
    nick: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", nick)
      .neq("id", userId)
      .limit(1);

    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  /**
   * 2) 디바운스 중복 체크
   */
  useEffect(() => {
    if (page.state !== "ready") return;

    setStatus("idle");
    setMessage("");

    const userId = page.userId;

    if (!nextNickname || nextNickname === currentNickname || !validation.valid) {
      setDup({ state: "idle" });
      return;
    }

    setDup({ state: "checking" });

    const timer = window.setTimeout(async () => {
      const myToken = ++reqTokenRef.current;

      try {
        const exists = await checkNicknameExists(userId, nextNickname);
        if (myToken !== reqTokenRef.current) return;

        setDup(exists ? { state: "taken" } : { state: "available" });
      } catch (e) {
        if (myToken !== reqTokenRef.current) return;
        setDup({
          state: "error",
          message:
            e instanceof Error
              ? e.message
              : "중복 확인 중 오류가 발생했습니다.",
        });
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [page, nextNickname, currentNickname, validation.valid]);

  const canSubmit =
    page.state === "ready" &&
    validation.valid &&
    nextNickname !== currentNickname &&
    dup.state === "available" &&
    status !== "saving";

  /**
   * 닉네임 변경
   */
  async function updateNickname() {
    if (page.state !== "ready") return;

    setStatus("saving");
    setMessage("");

    try {
      const exists = await checkNicknameExists(
        page.userId,
        nextNickname
      );

      if (exists) {
        setDup({ state: "taken" });
        setStatus("error");
        setMessage("이미 사용 중인 닉네임입니다.");
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ nickname: nextNickname })
        .eq("id", page.userId);

      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }

      setCurrentNickname(nextNickname);
      setDup({ state: "idle" });
      setStatus("success");
      setMessage("닉네임이 변경되었습니다.");
    } catch (e) {
      setStatus("error");
      setMessage(
        e instanceof Error ? e.message : "알 수 없는 오류가 발생했습니다."
      );
    }
  }

  /**
   * 로그아웃
   */
  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function renderHelperText() {
    if (!nextNickname) {
      return (
        <span className="opacity-60">
          한글/영어/숫자만 가능 (공백·특수문자 불가)
        </span>
      );
    }

    if (!validation.valid) {
      return <span className="text-red-300">{validation.message}</span>;
    }

    if (dup.state === "checking") return <span>중복 확인 중...</span>;
    if (dup.state === "taken")
      return <span className="text-red-300">이미 사용 중입니다.</span>;
    if (dup.state === "available")
      return <span className="text-emerald-200">사용 가능합니다.</span>;

    if (nextNickname === currentNickname) {
      return <span className="opacity-70">현재 닉네임과 동일합니다.</span>;
    }

    return <span className="opacity-70">형식은 통과했어요.</span>;
  }

  if (page.state !== "ready") {
    return null;
  }

  return (
    <>
      <Head>
        <title>Profile | Calmato</title>
      </Head>

      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">PROFILE</h1>
            <p className="mt-2 text-sm opacity-70">
              계정 정보와 닉네임을 관리할 수 있어요.
            </p>
          </div>

          <button
            onClick={logout}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm
                       opacity-80 transition hover:bg-white/10 hover:opacity-100"
          >
            로그아웃
          </button>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <div className="grid gap-5">
            <div>
              <div className="text-xs opacity-70">이메일</div>
              <div className="mt-1 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                {page.email}
              </div>
            </div>

            <div>
              <div className="text-xs opacity-70">현재 닉네임</div>
              <div className="mt-1 rounded-xl border border-white/10 bg-black/10 px-4 py-3 text-sm">
                {currentNickname || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs opacity-70">새 닉네임</div>

              <div className="mt-2 flex gap-3">
                <div className="flex-1">
                  <input
                    value={nextNickname}
                    onChange={(e) => {
                      setNextNickname(e.target.value);
                      setMessage("");
                      setStatus("idle");
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                  />
                  <div className="mt-2 text-xs">{renderHelperText()}</div>
                </div>

                <button
                  onClick={updateNickname}
                  disabled={!canSubmit}
                  className="h-[44px] rounded-xl px-5 text-sm font-medium
                             border border-white/10 bg-white/10
                             disabled:opacity-40"
                >
                  {status === "saving" ? "변경 중..." : "변경"}
                </button>
              </div>

              {message && (
                <div
                  className={`mt-3 rounded-xl border px-4 py-3 text-sm ${
                    status === "success"
                      ? "border-emerald-300/30 bg-emerald-300/10"
                      : "border-red-300/30 bg-red-300/10"
                  }`}
                >
                  {message}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
