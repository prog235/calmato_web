// components/TrackRow.tsx
import { useMemo, useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, useSpring, useTransform, useMotionValue } from "framer-motion";
import SimplePlayer from "./SimplePlayer";
import { getThumbnailUrl } from "@/lib/getUrl";

type Track = {
  id: string | number;
  title: string;
  subtitle: string;
  thumbnail_path: string;
  audio_path: string;
  desc_kim: string;
  desc_lee: string;
  youtube_url: string;
}

interface Props {
  track: Track;
}

export default function TrackRow({ track }: Props) {
  const [open, setOpen] = useState(false);

  // 1) 하나의 progress p(0→1)를 스프링으로 구동 (튀는 느낌 최소화)
  const p = useSpring(0, { stiffness: 120, damping: 30, mass: 0.9, restDelta: 0.001 });

  // 2) 배경/베일 진행도
  const clip = useTransform(p, (v) => `inset(0 0 ${(1 - v) * 100}% 0 round 12px)`); // 위→아래 와이프
  const bgY = useTransform(p, (v) => (1 - v) * -8);
  const bgOpacity = useTransform(p, (v) => v * 0.8);

  // 3) 제목 자리 유지를 위한 스페이서(가로 이동 최소화)
  const spacerW  = useTransform(p, (v) => 64 - v * 56); // 64→8
  const spacerMR = useTransform(p, (v) => 16 - v * 12);  // 16→4

  // 4) 상세 패널을 'height'로 펴고 접기 (배경과 완전 동기화)
  const contentRef = useRef<HTMLDivElement>(null);
  const naturalH = useMotionValue(0);                         // 콘텐츠 실제 높이
  const panelH = useTransform([p, naturalH], ([v, h]) => (v as number) * (h as number));

  // 이미 있는 p(useSpring) 아래에 추가
  const thumbOpacity = useTransform(p, v => 1 - v);     // 1 → 0
  const thumbScale   = useTransform(p, v => 1 - v*0.02); // 살짝 축소 (선택)
  const thumbY       = useTransform(p, v => -v*2);       // 살짝 위로 (선택)

  const panelMT  = useTransform(p, (v) => v * 12);            // 0 → 16px (mt-4 대체)
  const panelOpacity = p;

  // 마운트 제어: 펼칠 때 마운트, 접힐 때는 p만 0으로
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
    } else {
      p.set(0);
    }
  }, [open, p]);

  // mounted + DOM 준비된 뒤에 높이 측정하고 그 다음에 p를 1로
  useLayoutEffect(() => {
    if (!open || !mounted || !contentRef.current) return;

    naturalH.set(contentRef.current.scrollHeight);
    p.set(1);
  }, [open, mounted, track.desc_kim, track.desc_lee, track.youtube_url, track.title, track.subtitle, p]);
  
  useEffect(() => {
    const unsub = p.on("change", (v) => {
      if (!open && v <= 0.001) setMounted(false);
    });
    return unsub;
  }, [open, p]);

  const panelId = useMemo(
    () => `track-details-${track.id ?? track.title ?? "noid"}`,
    [track.id, track.title]
  );

  return (
    <div className="relative rounded-lg bg-[var(--foreground)]/7 p-3 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center min-w-0">
          {/* 썸네일 스페이서: 배경 진행도와 동기화 */}
          <motion.div
            className="h-16 rounded-md overflow-hidden"
            style={{ width: spacerW, marginRight: spacerMR }}
          >
            {track.thumbnail_path && (
              <motion.img
                src={getThumbnailUrl(track.thumbnail_path) ?? "default.png"}
                alt="" aria-hidden="true"
                className="h-16 w-16 rounded-md object-cover pointer-events-none"
                style={{ opacity: thumbOpacity, scale: thumbScale, y: thumbY }}
              />
            )}
          </motion.div>


          <div className="min-w-0">
            <h3 className="text-md font-semibold truncate">{track.title}</h3>
            {track.subtitle && <p className="text-sm subtext truncate">{track.subtitle}</p>}
          </div>
        </div>

        <div className="rounded-full bg-[var(--foreground)]/10 px-5 py-3">
          <SimplePlayer
            track={track}
            detailsOpen={open}
            onToggleDetails={() => setOpen((v) => !v)}
          />
        </div>
      </div>

      {/* 배경/베일/패널: mounted 동안만 렌더 */}
      {mounted && (
        <>
          {/* 배경: 위→아래 와이프 + 살짝 drop */}
          {track.thumbnail_path && (
            <motion.div
              className="absolute inset-0 z-0 overflow-hidden rounded-lg"
              style={{ clipPath: clip, transformOrigin: "top" }}
            >
              <motion.img
                src={getThumbnailUrl(track.thumbnail_path) ?? "default.png"}
                alt=""
                className="h-full w-full object-cover"
                style={{ y: bgY, opacity: bgOpacity }}
              />
            </motion.div>
          )}

          {/* 베일: 배경과 동일 clipPath로 동기화 */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-0 rounded-lg"
            style={{ clipPath: clip, opacity: p }}
          >
            <div
              className="w-full h-full"
              style={{
                background: "rgb(var(--veil)/0.2)"
              }}
            />
          </motion.div>

          {/* 상세 패널: height로 펴고 접기 → 배경과 완전 동기화 */}
          <motion.div
            id={panelId}
            className="relative z-10"
            style={{
              overflow: "hidden",
              height: panelH,        // ★ 핵심: height 애니메이션
              marginTop: panelMT,    // mt-4 대체
              opacity: panelOpacity,
            }}
          >
            {/* 실제 콘텐츠: 이 높이를 기준으로 panelH가 계산됨 */}
            <div ref={contentRef} className="rounded-xl border border-[var(--foreground)]/15 bg-[var(--background)]/30 backdrop-blur-md px-5 py-5 md:px-6 md:py-6">
              <div className="grid gap-6 md:grid-cols-2">
                {track.desc_kim && (
                  <div>
                    <div className="text-md font-semibold subtext mb-4">ㅣ 영상 기획 의도</div>
                    <p className="text-sm leading-7">{track.desc_kim}</p>
                  </div>
                )}
                {track.desc_lee && (
                  <div>
                    <div className="text-md font-semibold subtext mb-4">ㅣ  음악 기획 의도</div>
                    <p className="text-sm leading-7">{track.desc_lee}</p>
                  </div>
                )}
                {track.youtube_url && (
                  <div className="md:col-span-2">
                    <a
                      href={track.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm 
                                 bg-white/15 hover:bg-white/25 transition shadow-sm"
                    >
                      유튜브로 열기 <span aria-hidden>↗︎</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
