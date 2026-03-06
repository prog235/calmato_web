// components/community/PostCard.tsx
import Link from "next/link";
import Image from "next/image";

type PostCardProps = {
  // Rendering
  href: string;
  isLocked: boolean;

  // Author / time
  nickname: string;
  createdAt: string; // ISO string

  // Content
  title: string;
  content: string;

  // Metrics
  likeCount: number;
  commentCount: number;
  viewCount: number;

  // Optional background image URL (already resolved to a public URL)
  backgroundImageUrl?: string | null;
};

function formatKoreanDateTime(iso: string) {
  const d = new Date(iso);
  // YYYY.MM.DD HH:MM style
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} ${hh}:${min}`;
}

export default function PostCard(props: PostCardProps) {
  const {
    href,
    isLocked,
    nickname,
    createdAt,
    title,
    content,
    likeCount,
    commentCount,
    viewCount,
    backgroundImageUrl,
  } = props;

  if (isLocked) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
        <div className="relative flex h-full min-h-[210px] flex-col items-center justify-center gap-3 text-center">
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
    <Link
      href={href}
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] transition-transform duration-200 hover:-translate-y-1 hover:border-white/20"
    >
      {/* Background image (optional) */}
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
          {/* Dark overlay */}
          <div className="absolute inset-0 bg-black/55" />
          {/* Gentle top gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/40" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent_55%)]" />
      )}

      <div className="relative flex min-h-[210px] flex-col p-5">
        {/* Top meta */}
        <div className="mb-3 flex items-center gap-2 text-xs text-white/55">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-6 w-6 rounded-full bg-white/10" />
            <span className="truncate">{nickname}</span>
          </span>
          <span className="text-white/30">•</span>
          <span>{formatKoreanDateTime(createdAt)}</span>
        </div>

        {/* Title */}
        <div className="mb-2 line-clamp-1 text-base font-semibold text-white/90">
          {title}
        </div>

        {/* Excerpt (2 lines clamp) */}
        <div className="line-clamp-2 text-sm leading-relaxed text-white/70">
          {content.slice(0, 120)}
        </div>

        {/* Bottom metrics pinned */}
        <div className="mt-auto pt-4">
          <div className="flex items-center gap-4 text-xs text-white/60">
            <div className="flex items-center gap-1">
              <span className="text-white/70">♥</span>
              <span>{likeCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-white/70">💬</span>
              <span>{commentCount}</span>
            </div>
            <div className="ml-auto flex items-center gap-1">
              <span className="text-white/70">👁</span>
              <span>{viewCount}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
