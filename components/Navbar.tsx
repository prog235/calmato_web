import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Pencil, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import ProfileAvatar from "@/components/ProfileAvatar";
import { PROFILE_IMAGES_BUCKET } from "@/lib/profileImages";
import { supabase } from "@/lib/supabaseClient";
import { validateNickname } from "@/lib/validateNickname";

type ProfilePopupState =
  | { state: "idle" }
  | { state: "loading" }
  | {
      state: "ready";
      userId: string;
      email: string;
      nickname: string;
      profileImagePath: string | null;
    }
  | { state: "error"; message: string };

type DupState =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "available" }
  | { state: "taken" }
  | { state: "error"; message: string };

function safeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

function makeProfileImagePath(userId: string, file: File) {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return `${userId}/${uuid}_${safeFileName(file.name)}`;
}

export default function Navbar() {
  const router = useRouter();
  const popupRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfilePopupState>({ state: "idle" });
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nextNickname, setNextNickname] = useState("");
  const [dup, setDup] = useState<DupState>({ state: "idle" });
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const links = [
    { href: "/", label: "Home" },
    { href: "/about", label: "About" },
    { href: "/archive", label: "Archive" },
    { href: "/community", label: "Community" },
    { href: "/contact", label: "Contact" },
  ];

  const validation = useMemo(
    () => validateNickname(nextNickname),
    [nextNickname]
  );

  async function loadProfile() {
    setProfile({ state: "loading" });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      setProfile({ state: "error", message: userError.message });
      return;
    }

    if (!user) {
      setIsProfileOpen(false);
      router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, profile_image_path")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setProfile({ state: "error", message: error.message });
      return;
    }

    const nickname = data?.nickname ?? "Unknown";

    setProfile({
      state: "ready",
      userId: user.id,
      email: user.email ?? "",
      nickname,
      profileImagePath: data?.profile_image_path ?? null,
    });
    setNextNickname(nickname);
    setDup({ state: "idle" });
    setIsEditingNickname(false);
  }

  async function handleProfileButtonClick() {
    if (isProfileOpen) {
      setIsProfileOpen(false);
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setIsProfileOpen(false);
      await router.push(`/login?next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    setIsProfileOpen(true);
    void loadProfile();
  }

  async function checkNicknameExists(userId: string, nickname: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("nickname", nickname)
      .neq("id", userId)
      .limit(1);

    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }

  async function saveNickname() {
    if (profile.state !== "ready") return;
    if (!validation.valid || dup.state !== "available") return;

    setIsSavingNickname(true);

    try {
      const nickname = nextNickname.trim();
      const { error } = await supabase
        .from("profiles")
        .update({ nickname })
        .eq("id", profile.userId);

      if (error) throw error;

      setProfile({ ...profile, nickname });
      setIsEditingNickname(false);
      setDup({ state: "idle" });
    } catch (e) {
      setDup({
        state: "error",
        message:
          e instanceof Error ? e.message : "닉네임 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSavingNickname(false);
    }
  }

  async function uploadProfileImage(file: File) {
    if (profile.state !== "ready") return;

    if (!file.type.startsWith("image/")) {
      setProfile({ state: "error", message: "이미지 파일만 선택할 수 있습니다." });
      return;
    }

    setIsUploadingImage(true);

    try {
      const path = makeProfileImagePath(profile.userId, file);
      const { error: uploadError } = await supabase.storage
        .from(PROFILE_IMAGES_BUCKET)
        .upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) throw uploadError;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ profile_image_path: path })
        .eq("id", profile.userId);

      if (updateError) throw updateError;

      setProfile({ ...profile, profileImagePath: path });
    } catch (e) {
      setProfile({
        state: "error",
        message:
          e instanceof Error
            ? e.message
            : "프로필 이미지 변경 중 오류가 발생했습니다.",
      });
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setIsProfileOpen(false);
    router.push("/login");
  }

  function renderNicknameHelper() {
    if (!isEditingNickname) return null;

    if (!nextNickname.trim()) {
      return <p className="mt-2 text-xs text-red-300">닉네임을 입력해주세요.</p>;
    }

    if (!validation.valid) {
      return <p className="mt-2 text-xs text-red-300">{validation.message}</p>;
    }

    if (profile.state === "ready" && nextNickname.trim() === profile.nickname) {
      return <p className="mt-2 text-xs text-emerald-300">현재 닉네임입니다.</p>;
    }

    if (dup.state === "checking") {
      return <p className="mt-2 text-xs text-white/50">중복 확인 중...</p>;
    }

    if (dup.state === "taken") {
      return <p className="mt-2 text-xs text-red-300">이미 사용 중입니다.</p>;
    }

    if (dup.state === "available") {
      return <p className="mt-2 text-xs text-emerald-300">사용 가능합니다.</p>;
    }

    if (dup.state === "error") {
      return <p className="mt-2 text-xs text-red-300">{dup.message}</p>;
    }

    return <p className="mt-2 text-xs text-emerald-300">형식은 사용할 수 있습니다.</p>;
  }

  useEffect(() => {
    if (!isProfileOpen) return;

    function handlePointerDown(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isProfileOpen]);

  useEffect(() => {
    if (!isEditingNickname || profile.state !== "ready") return;

    const next = nextNickname.trim();

    if (!validation.valid || next === profile.nickname) {
      setDup({ state: "idle" });
      return;
    }

    setDup({ state: "checking" });

    const timer = window.setTimeout(async () => {
      try {
        const exists = await checkNicknameExists(profile.userId, next);
        setDup(exists ? { state: "taken" } : { state: "available" });
      } catch (e) {
        setDup({
          state: "error",
          message:
            e instanceof Error
              ? e.message
              : "중복 확인 중 오류가 발생했습니다.",
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [isEditingNickname, nextNickname, profile, validation.valid]);

  return (
    <header
      className="
        w-full
        px-8 sm:px-12 md:px-16
        py-8
        flex
        items-center
        justify-between
      "
    >
      <Link
        href="/"
        className="relative w-[160px] h-[80px] hover:opacity-80 transition"
      >
        <Image
          src="/calmato_b_logo@4x.png"
          alt="Calmato Logo Light"
          fill
          className="object-contain logo-light"
          priority
        />

        <Image
          src="/calmato_w_logo@4x.png"
          alt="Calmato Logo Dark"
          fill
          className="object-contain logo-dark"
          priority
        />
      </Link>

      <nav className="flex items-center gap-10 text-[13px]">
        {links.map((link) => {
          const isActive = router.pathname === link.href;

          return (
            <motion.div
              key={link.href}
              whileHover={{ y: -2 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Link
                href={link.href}
                className={`
                  transition
                  ${
                    isActive
                      ? "font-semibold text-white"
                      : "text-white/80 hover:text-white"
                  }
                `}
              >
                {link.label}
              </Link>
            </motion.div>
          );
        })}

        <div ref={popupRef} className="relative">
          <button
            type="button"
            onClick={() => void handleProfileButtonClick()}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/5 text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition hover:border-white/45 hover:bg-white/12 hover:text-white"
            aria-label="프로필"
            aria-expanded={isProfileOpen}
          >
            <UserRound size={18} strokeWidth={1.7} />
          </button>

          <AnimatePresence>
            {isProfileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-14 z-50 min-h-[380px] w-[280px] origin-top-right rounded-2xl border border-white/15 bg-[#151515]/90 p-7 text-center shadow-[0_30px_80px_rgba(0,0,0,0.88),0_0_0_1px_rgba(255,255,255,0.05),0_0_36px_rgba(255,255,255,0.08)] backdrop-blur-md"
            >
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="absolute right-5 top-5 text-white/65 transition hover:text-white"
                aria-label="닫기"
              >
                <X size={20} />
              </button>

              {profile.state === "loading" && (
                <div className="flex min-h-[334px] items-center justify-center text-sm text-white/55">
                  프로필을 불러오는 중...
                </div>
              )}

              {profile.state === "error" && (
                <div className="flex min-h-[334px] items-center justify-center text-sm text-red-300">
                  {profile.message}
                </div>
              )}

              {profile.state === "ready" && (
                <>
                  <div className="relative mx-auto h-32 w-32">
                    <ProfileAvatar
                      imagePath={profile.profileImagePath}
                      className="mt-4 h-32 w-32 border border-white/10"
                      sizes="128px"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="absolute bottom-0 right-0 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#1a1a1a] text-white/75 shadow-[0_8px_24px_rgba(0,0,0,0.35)] transition hover:border-white/40 hover:text-white disabled:opacity-50"
                      aria-label="프로필 이미지 수정"
                    >
                      <Camera size={20} strokeWidth={1.8} />
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void uploadProfileImage(file);
                        e.target.value = "";
                      }}
                    />
                  </div>

                  <div className="mt-8">
                    {isEditingNickname ? (
                      <div>
                        <div className="flex items-center gap-2">
                          <input
                            value={nextNickname}
                            onChange={(e) => setNextNickname(e.target.value)}
                            className="h-11 min-w-0 flex-1 rounded-xl border border-white/12 bg-white/5 px-3 text-center text-lg font-semibold text-white outline-none transition focus:border-white/30"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={saveNickname}
                            disabled={
                              isSavingNickname ||
                              !validation.valid ||
                              dup.state !== "available"
                            }
                            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-white/8 text-white/75 transition hover:bg-white/12 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                            aria-label="닉네임 확인"
                          >
                            <Check size={18} />
                          </button>
                        </div>
                        {renderNicknameHelper()}
                      </div>
                    ) : (
                      <h2 className="text-xl font-semibold text-white">
                        {profile.nickname}
                      </h2>
                    )}

                    <p className="mt-2 subtext">{profile.email}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingNickname((editing) => !editing);
                      setNextNickname(profile.nickname);
                      setDup({ state: "idle" });
                    }}
                    className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/16 px-5 py-2 text-sm text-white/78 transition hover:border-white/32 hover:bg-white/8 hover:text-white"
                  >
                    <Pencil size={15} />
                    {isEditingNickname ? "수정 취소" : "닉네임 변경"}
                  </button>

                  <div className="mt-5 border-t border-white/10 pt-5">
                    <button
                      type="button"
                      onClick={logout}
                      className="text-sm text-white/45 transition hover:text-white/80"
                    >
                      로그아웃
                    </button>
                  </div>
                </>
              )}
            </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  );
}
