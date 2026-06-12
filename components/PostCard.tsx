// components/community/PostCard.tsx
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/router";
import { Eye, Heart, LockKeyhole, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import LoginRequiredModal from "@/components/LoginRequiredModal";
import ProfileAvatar from "@/components/ProfileAvatar";

type PostCardProps = {
  href: string;
  postId: number;
  isLocked: boolean;
  isOwnSecret: boolean;

  nickname: string;
  profileImagePath?: string | null;
  createdAt: string;

  title: string;
  content: string;

  likeCount: number;
  commentCount: number;
  viewCount: number;
  initialLiked: boolean;

  backgroundImageUrl?: string | null;
  backgroundColor?: string | null;
};

function formatKoreanDateTime(iso: string) {
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function PostCard(props: PostCardProps) {
  const router = useRouter();
  const {
    href,
    postId,
    isLocked,
    isOwnSecret,
    nickname,
    profileImagePath,
    createdAt,
    title,
    content,
    likeCount,
    commentCount,
    viewCount,
    initialLiked,
    backgroundImageUrl,
    backgroundColor,
  } = props;

  const [isLiked, setIsLiked] = useState(initialLiked);
  const [currentLikeCount, setCurrentLikeCount] = useState(likeCount);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  const handleLike = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLikeLoading) return;

    setIsLikeLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLikeLoading(false);
      setLoginModalOpen(true);
      return;
    }

    const prevLiked = isLiked;
    const prevCount = currentLikeCount;

    setIsLiked(!prevLiked);
    setCurrentLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);

    if (prevLiked) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) {
        setIsLiked(prevLiked);
        setCurrentLikeCount(prevCount);
        console.error(error);
      }
    } else {
      const { error } = await supabase.from("post_likes").insert({
        post_id: postId,
        user_id: user.id,
      });

      if (error) {
        setIsLiked(prevLiked);
        setCurrentLikeCount(prevCount);
        console.error(error);
      }
    }

    setIsLikeLoading(false);
  };

  if (isLocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative flex h-full min-h-[160px] flex-col items-center justify-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
            <span className="text-2xl text-white/70">🔒</span>
          </div>
          <div className="text-base font-semibold text-white/85">비밀글입니다.</div>
          <div className="text-sm text-white/55">작성자만 열람할 수 있어요.</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link
        href={href}
        className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-1 hover:border-white/20"
      >
        {backgroundImageUrl ? (
          <div className="absolute inset-0">
            <Image
              src={backgroundImageUrl}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover opacity-60 transition-opacity duration-200 group-hover:opacity-70"
              priority={false}
            />
            <div className="absolute inset-0 bg-black/55" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40" />
          </div>
        ) : backgroundColor ? (
          <div className="absolute inset-0" style={{ backgroundColor }}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
        )}

        <div className="relative flex min-h-[220px] flex-col px-5 pt-5 pb-4">
          {/* Top meta */}
          <div className="mb-4 flex items-center justify-between gap-2 text-[13px] text-white/60">
            <span className="inline-flex h-6 min-w-0 items-center gap-3">
              <ProfileAvatar
                imagePath={profileImagePath}
                className="h-6 w-6 shrink-0 ring-1 ring-white/10"
                sizes="24px"
              />
              <span className="min-w-0 truncate leading-none">{nickname}</span>
              {isOwnSecret && (
                <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-2.5 text-[11px] font-medium text-white/75 ring-1 ring-white/15">
                  <LockKeyhole size={12} aria-hidden="true" />
                  <span className="leading-none">내 비밀글</span>
                </span>
              )}
            </span>

            <span className="flex h-6 shrink-0 items-center leading-none">
              {formatKoreanDateTime(createdAt)}
            </span>
          </div>

          {/* Content block */}
          <div className="flex-1 overflow-hidden">
            <div className="mb-3 line-clamp-1 text-base font-semibold text-white/90">
              {title}
            </div>

            <div className="line-clamp-2 text-sm leading-relaxed text-white/70">
              {content.slice(0, 120)}
            </div>
          </div>

          {/* Bottom metrics */}
          <div className="mt-auto pt-5">
            <div className="mb-4 h-px bg-white/7" />

            <div className="flex items-center gap-4 text-[13px] text-white/60">
              <button
                type="button"
                onClick={handleLike}
                disabled={isLikeLoading}
                className="relative z-10 flex items-center gap-1.5 transition hover:text-white"
              >
                <Heart
                  size={17}
                  className={
                    isLiked
                      ? "relative top-[0.5px] fill-red-500 text-red-500"
                      : "relative top-[0.5px] text-white/55 transition hover:text-red-400"
                  }
                />
                <span className="leading-none">{currentLikeCount}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <MessageCircle size={17} className="relative top-[0.5px] text-white/55" />
                <span className="leading-none">{commentCount}</span>
              </div>

              <div className="ml-auto flex items-center gap-1.5 pr-[2px]">
                <Eye size={17} className="relative top-[0.5px] text-white/55" />
                <span className="leading-none">{viewCount}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
      <LoginRequiredModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        nextPath={router.asPath}
      />
    </>
  );
}
