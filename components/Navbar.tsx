import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/router";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, Check, Menu, Pencil, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import navStyles from "@/styles/navbar.module.css";

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
  const headerRef = useRef<HTMLElement | null>(null);
  const desktopNavRef = useRef<HTMLDivElement | null>(null);
  const [isCompactNav, setIsCompactNav] = useState(true);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profile, setProfile] = useState<ProfilePopupState>({ state: "idle" });
  const [isEditingNickname, setIsEditingNickname] = useState(false);
  const [nextNickname, setNextNickname] = useState("");
  const [dup, setDup] = useState<DupState>({ state: "idle" });
  const [isSavingNickname, setIsSavingNickname] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const links = useMemo(
    () => [
      ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
      { href: "/", label: "Home" },
      { href: "/about", label: "About" },
      { href: "/archive", label: "Archive" },
      { href: "/community", label: "Community" },
      { href: "/contact", label: "Contact" },
    ],
    [isAdmin]
  );

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

  async function loadAdminStatus() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    setIsAdmin(!error && data?.role === "admin");
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

  function closeMobileMenu() {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
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
    setIsAdmin(false);
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

  function renderProfilePanelContent() {
    return (
      <>
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
      </>
    );
  }

  useEffect(() => {
    void loadAdminStatus();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void loadAdminStatus();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    const navigation = desktopNavRef.current;
    if (!header || !navigation) return;

    function syncViewport() {
      if (!header || !navigation) return;
      const style = window.getComputedStyle(header);
      // A wide flex child can keep the document/header wider than the viewport.
      // Always use the visible viewport as the upper bound when resizing.
      const viewportWidth = Math.min(window.innerWidth, document.documentElement.clientWidth);
      const availableWidth = Math.min(header.clientWidth, viewportWidth) -
        parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      // Measure the full menu (including Admin) without ever shrinking the logo.
      setIsCompactNav(
        viewportWidth < 768 || availableWidth < 160 + navigation.offsetWidth + 48
      );
    }

    const observer = new ResizeObserver(syncViewport);
    observer.observe(header);
    observer.observe(navigation);
    window.addEventListener("resize", syncViewport);
    window.visualViewport?.addEventListener("resize", syncViewport);
    syncViewport();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncViewport);
      window.visualViewport?.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    closeMobileMenu();
  }, [isCompactNav]);

  useEffect(() => {
    if (!isProfileOpen) return;
    if (isCompactNav) return;

    function handlePointerDown(e: MouseEvent) {
      if (!popupRef.current?.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [isProfileOpen, isCompactNav]);

  useEffect(() => {
    closeMobileMenu();
    setIsProfileOpen(false);
  }, [router.asPath]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") closeMobileMenu();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

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
      ref={headerRef}
      data-compact={isCompactNav}
      className={`${navStyles.header} relative z-50 flex w-full items-center page-gutter py-5 ${
        isCompactNav ? "min-h-[120px] justify-center" : "justify-between py-8"
      }`}
    >
      <div
        ref={desktopNavRef}
        aria-hidden="true"
        inert
        className="flex w-max items-center gap-10 whitespace-nowrap text-[13px]"
        style={{ position: "fixed", left: -10000, top: 0, visibility: "hidden", pointerEvents: "none" }}
      >
        {links.map((link) => (
          <span key={link.href} className={router.pathname === link.href ? "font-semibold" : undefined}>
            {link.label}
          </span>
        ))}
        <span className="block h-10 w-10 shrink-0" />
      </div>
      <div aria-hidden="true" className="h-[80px] w-[160px] shrink-0" />
      <AnimatePresence mode="wait">
        <motion.div
          key={isCompactNav ? "centered-logo" : "desktop-logo"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`${navStyles.logo} absolute top-1/2 -translate-y-1/2 ${
            isCompactNav ? "left-1/2 -translate-x-1/2" : "left-[var(--page-gutter)]"
          }`}
        >
          <Link
            href="/"
            onClick={closeMobileMenu}
            className="relative block h-[80px] w-[160px] transition-opacity duration-[300ms] hover:opacity-80"
          >
            <Image
              src="/calmato_b_logo@4x.png"
              alt="Calmato Logo Light"
              fill
              sizes="160px"
              className="object-contain logo-light"
              priority
            />
    
            <Image
              src="/calmato_w_logo@4x.png"
              alt="Calmato Logo Dark"
              fill
              sizes="160px"
              className="object-contain logo-dark"
              priority
            />
          </Link>
        </motion.div>
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setIsMobileMenuOpen((open) => !open)}
        aria-hidden={!isCompactNav}
        inert={!isCompactNav}
        className={`${navStyles.mobileToggle} absolute right-[var(--page-gutter)] top-1/2 h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl border border-white/15 bg-white/[0.04] text-white/82 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] transition hover:border-white/30 hover:bg-white/[0.08]`}
        aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-navigation"
      >
        {isMobileMenuOpen ? (
          <X size={20} strokeWidth={1.8} aria-hidden="true" />
        ) : (
          <Menu size={21} strokeWidth={1.8} aria-hidden="true" />
        )}
      </button>

      <nav
        aria-hidden={isCompactNav}
        inert={isCompactNav}
        className={`${navStyles.desktopNavigation} absolute right-[var(--page-gutter)] top-1/2 flex w-max -translate-y-1/2 items-center gap-10 whitespace-nowrap text-[13px]`}
      >
        {links.map((link) => {
          const isActive =
            router.pathname === link.href ||
            (link.href === "/admin" && router.pathname.startsWith("/admin/"));

          return (
            <div key={link.href}>
              <Link
                href={link.href}
                className={`
                  transition-opacity duration-[450ms] hover:opacity-100
                  ${
                    isActive
                      ? "font-semibold text-white"
                      : "text-white opacity-75"
                  }
                `}
              >
                {link.label}
              </Link>
            </div>
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
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

      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.button
              type="button"
              aria-label="메뉴 닫기"
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              onClick={closeMobileMenu}
            />
            <motion.nav
              id="mobile-navigation"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(82vw,340px)] flex-col overflow-y-auto border-l border-white/12 bg-[#101010]/96 px-5 py-6 shadow-[-28px_0_80px_rgba(0,0,0,0.58)] backdrop-blur-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.28em] text-white/35">
                  Menu
                </span>
                <button
                  type="button"
                  onClick={closeMobileMenu}
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white/58 transition hover:bg-white/[0.07] hover:text-white"
                  aria-label="메뉴 닫기"
                >
                  <X size={19} strokeWidth={1.8} aria-hidden="true" />
                </button>
              </div>

              <div className="mt-8 flex flex-col gap-1">
                {links.map((link) => {
                  const isActive =
                    router.pathname === link.href ||
                    (link.href === "/admin" && router.pathname.startsWith("/admin/"));

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={closeMobileMenu}
                      className={[
                        "flex h-[52px] items-center rounded-xl px-4 text-[15px] transition",
                        isActive
                          ? "bg-white/[0.09] font-semibold text-white"
                          : "text-white/70 hover:bg-white/[0.06] hover:text-white",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-auto border-t border-white/10 pt-5">
                <AnimatePresence mode="wait">
                  {isProfileOpen ? (
                    <motion.div
                      key="mobile-profile-panel"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="relative rounded-2xl border border-white/12 bg-white/[0.035] p-5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                    >
                      {renderProfilePanelContent()}
                    </motion.div>
                  ) : (
                    <motion.button
                      key="mobile-profile-button"
                      type="button"
                      onClick={() => void handleProfileButtonClick()}
                      className="flex w-full items-center gap-3 rounded-2xl bg-white/[0.045] px-4 py-4 text-left text-sm text-white/74 ring-1 ring-white/10 transition hover:bg-white/[0.08] hover:text-white"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/18 bg-white/[0.05]">
                        <UserRound size={16} strokeWidth={1.7} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-white/82">
                          프로필
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-white/38">
                          계정 정보 보기
                        </span>
                      </span>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
