import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { getImage } from "@/lib/getUrl";

const ABOUT_IMAGE_SRC = getImage("assets", "about_img.jpg");

const SLIDE_COUNT = 3;

const principles = [
  {
    title: "Subtle Serenity",
    subtitle: "은은한 평온",
    description: [
      "세상이 너무 빠르게 돌아간다고 느껴질 때, 언제든 이곳에 머무는 순간만큼은", 
      "당신의 시간이 평온하고 따스하게 흐르길 바랍니다."
    ],
  },
  {
    title: "Artistic Noise",
    subtitle: "소음의 예술화",
    description: [
      "소음은 지우는 것이 아니라, 새로운 가치를 부여하는 것입니다.", 
      "무심코 지나쳤던 생활의 소리 속에 숨겨진 리듬을 찾아내어 정교하게 빚어냅니다."
    ],
  },
  {
    title: "Emotional Rest",
    subtitle: "마음의 쉼표",
    description: [
      "긴 하루를 지나온 당신이 차분히 하루를 마무리할 수 있도록,",
      "우리의 영상은 하루 끝에 놓이는 작음 쉼표가 되고자 합니다."
    ],
  },
  {
    title: "Immersive Focus",
    subtitle: "몰입의 시간",
    description: [
      "공부할 때도, 일을 할 때도, 생각에 잠긴 순간에도",
      "당신의 시간이 흔들림 없이 이어지도록 곁에 머물겠습니다."
    ],
  },
  {
    title: "Sensory Link",
    subtitle: "감각의 연결",
    description: [
      "배경은 단순한 화면이 아닌, 소리를 시각적으로 완성하는 마지막 조각입니다.",
      "곡의 온도와 감정을 닮은 장면으로, 음악의 여운을 더욱 깊게 전합니다."
    ],
  },
];

type Principle = (typeof principles)[number];
type FocusOrigin = {
  x: number;
  y: number;
  centerX: number;
  centerY: number;
};

function clampIndex(index: number) {
  return (index + SLIDE_COUNT) % SLIDE_COUNT;
}

function AboutIntroSlide() {
  return (
    <section className="absolute inset-0 grid mt-4 gap-12 px-8 py-12 sm:px-12 md:px-16 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.8fr)]">
      <div className="absolute inset-0">
        <Image
          src={ABOUT_IMAGE_SRC}
          alt="Calmato about background"
          fill
          priority
          className="object-cover"
        />
      </div>
      <div className="absolute inset-0" />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
        className="relative z-10 max-w-[560px]"
      >
        <div className="mb-8 flex items-center gap-4 text-[13px] uppercase tracking-[0.45em] text-white/46">
          <span>About</span>
          <span className="normal-case tracking-[0.08em] text-white/40">Calmato</span>
        </div>

        <h1 className="text-[46px] font-normal leading-[1.14] tracking-normal text-white sm:text-[58px] md:text-[68px]">
          May You End
          <br />
          Your Day
          <br />
          <span className="text-[#d07a45]">Calmly</span> <span>and</span>
          <br />
          Peacefully
        </h1>

        <div className="mt-8 h-px w-24 bg-white/35" />
        <p className="mt-7 text-[15px] leading-8 text-white/78">
          당신의 긴 하루, 그 끝이 고요하고 평온하길
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: "easeOut", delay: 0.18 }}
        className="relative z-10 max-w-[520px] justify-self-start lg:mt-44 lg:pl-36"
      >
        <div className="text-[56px] leading-none text-white/58">“</div>
        <p className="mt-1 text-[14px] leading-7 text-white/82">
          Calmato는 “조용히, 고요하게”라는 뜻의 이탈리아어입니다.
        </p>

        <div className="mt-7 h-px w-16 bg-white/32" />

        <div className="mt-7 space-y-6 text-[14px] leading-8 text-white/80">
          <p>
            하루의 끝, 소란이 천천히 잦아든 자리에서
            <br />
            비로소 들려오는 작은 고요를 따라,
            <br />
            말로 다 남기지 못한 감정과 하루의 잔향을
            <br />
            익숙한 소리들과 피아노의 흐름 안에 담아냈습니다.
          </p>

          <p>
            그렇게 완성된 음악이 당신의 하루에 잔잔히 스며들어,
            <br />
            당신 곁에 조용한 위로로 남기를 바랍니다.
          </p>
        </div>
      </motion.div>
    </section>
  );
}

function AboutPrinciplesSlide({
  onDetailChange,
}: {
  onDetailChange?: (isDetail: boolean) => void;
}) {
  const [selectedPrinciple, setSelectedPrinciple] = useState<Principle | null>(null);
  const [phase, setPhase] = useState<"overview" | "focus" | "detail">("overview");
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [focusOrigin, setFocusOrigin] = useState<FocusOrigin | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const tickerItems = [...principles, ...principles];

  useEffect(() => {
    onDetailChange?.(phase === "detail");
  }, [onDetailChange, phase]);

  useEffect(() => {
    if (phase !== "focus") return;

    const timer = window.setTimeout(() => {
      setPhase("detail");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [phase, selectedPrinciple]);

  function selectPrinciple(
    principle: Principle,
    event?: MouseEvent<HTMLButtonElement>
  ) {
    const sectionRect = sectionRef.current?.getBoundingClientRect();

    if (sectionRect && event?.currentTarget) {
      const targetRect = event.currentTarget.getBoundingClientRect();
      setFocusOrigin({
        x: targetRect.left - sectionRect.left + targetRect.width / 2,
        y: targetRect.top - sectionRect.top + targetRect.height / 2,
        centerX: window.innerWidth / 2 - sectionRect.left,
        centerY: window.innerHeight / 2 - sectionRect.top,
      });
    } else if (sectionRect) {
      setFocusOrigin({
        x: window.innerWidth / 2 - sectionRect.left,
        y: window.innerHeight / 2 - sectionRect.top,
        centerX: window.innerWidth / 2 - sectionRect.left,
        centerY: window.innerHeight / 2 - sectionRect.top,
      });
    }

    setSelectedPrinciple(principle);
    setSoundBlocked(false);
    setPhase("focus");
  }

  function getVideoUrl(principle: Principle) {
    return getImage("assets", `kim_about/${principle.title}.mp4`);
  }

  useEffect(() => {
    if (phase !== "detail" || !selectedPrinciple) return;

    const video = videoRef.current;
    if (!video) return;

    video.muted = false;
    video.volume = 1;

    void video.play().catch(() => {
      video.muted = true;
      setSoundBlocked(true);
      void video.play().catch(() => {
        // Leave the native video state alone if playback is blocked entirely.
      });
    });
  }, [phase, selectedPrinciple]);

  function renderTicker({ compact = false }: { compact?: boolean } = {}) {
    return (
      <div className="relative z-10 w-screen overflow-hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-[10vw] bg-gradient-to-r from-[#0a0a0a] via-[#080808]/82 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-[10vw] bg-gradient-to-l from-[#0a0a0a] via-[#080808]/82 to-transparent" />
        <motion.div
          className={[
            "flex w-max items-center whitespace-nowrap px-8",
            compact ? "gap-16 sm:gap-20" : "gap-16 sm:gap-20",
          ].join(" ")}
          animate={{ x: ["-50%", "0%"] }}
          transition={{
            duration: 26,
            ease: "linear",
            repeat: Infinity,
          }}
        >
          {tickerItems.map((item, idx) => (
            <button
              key={`${item.title}-${idx}`}
              type="button"
              onClick={(event) => selectPrinciple(item, event)}
              className="min-w-[180px] text-center transition hover:text-white sm:min-w-[190px]"
            >
              <div
                className={[
                  "text-[20px] sm:text-[22px]",
                  selectedPrinciple?.title === item.title
                    ? "text-white/30"
                    : "text-white",
                ].join(" ")}
              >
                {item.title}
              </div>
              <div className="mt-1 text-[12px] text-white/30">
                {item.subtitle}
              </div>
            </button>
          ))}
        </motion.div>
      </div>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="absolute inset-0 flex flex-col items-center justify-center overflow-x-hidden overflow-y-auto px-8 text-center"
    >
      <div className="absolute inset-0" />

      <AnimatePresence>
        {phase !== "detail" && (
          <motion.div
            key="principle-overview"
            initial={{ opacity: 0, y: 18 }}
            animate={{
              opacity: phase === "focus" ? 0 : 1,
              y: phase === "focus" ? -10 : 0,
            }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.7, ease: "easeInOut" }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center"
          >
            <div>
              <p className="text-[20px] leading-8 text-white/92 sm:text-[24px]">
                Crafting space with sound, enhancing depth with scenes
              </p>
              <p className="mt-4 text-[14px] text-white/42 sm:text-[16px]">
                소리로 공간을 창조하고, 장면으로 깊이를 더하다
              </p>
            </div>

            <div className="mt-20">
              {renderTicker()}
            </div>

            <p className="mt-28 text-[14px] subtext">
              해당 페이지는 음향이 재생됩니다.
            </p>
          </motion.div>
        )}

        {phase === "focus" && selectedPrinciple && (
          <motion.div
            key={`principle-focus-${selectedPrinciple.title}`}
            initial={{
              opacity: 1,
              x: focusOrigin?.x ?? 0,
              y: focusOrigin?.y ?? 0,
            }}
            animate={{
              opacity: 1,
              x: focusOrigin?.centerX ?? 0,
              y: focusOrigin?.centerY ?? 0,
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.05, ease: [0.4, 0, 0.2, 1] }}
            className="absolute left-0 top-0 z-30"
          >
            <div className="-translate-x-1/2 -translate-y-1/2">
              <motion.div
                initial={{ scale: 1 }}
                animate={{ scale: 2.18 }}
                transition={{ duration: 1.05, ease: [0.4, 0, 0.2, 1] }}
                className="text-center"
              >
                <div className="text-[20px] leading-none text-white sm:text-[22px]">
                  {selectedPrinciple.title}
                </div>
                <div className="mt-1 text-[12px] text-white/30">
                  {selectedPrinciple.subtitle}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}

        {phase === "detail" && selectedPrinciple && (
          <motion.div
            key={`principle-detail-${selectedPrinciple.title}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="absolute inset-0 z-10 flex min-h-full w-full flex-col overflow-y-auto px-8 pb-6"
          >
            <div className="flex shrink-0 flex-col items-center">
              <video
                ref={videoRef}
                key={selectedPrinciple.title}
                src={getVideoUrl(selectedPrinciple)}
                className="aspect-[21/12] w-full rounded-md object-cover max-h-[50vh]"
                autoPlay
                muted={false}
                playsInline
              />

              <div className="mt-8 max-w-[620px] text-center">
                <h2 className="text-[22px] font-semibold text-white">
                  {selectedPrinciple.title}
                </h2>
                <p className="mt-2 text-[12px] text-white/20">
                  {selectedPrinciple.subtitle}
                </p>
                <div className="mt-6 text-[14px] leading-6 text-white/78">
                  {selectedPrinciple.description.map((line) => (
                    <p key={line}>{line}</p>
                  ))}
                </div>
                {soundBlocked && (
                  <p className="mt-3 text-[11px] text-white/32">
                    브라우저 정책으로 음향이 자동 재생되지 않아 무음으로 재생됩니다.
                  </p>
                )}
              </div>
            </div>

            <div className="-mx-8 mt-12 flex w-screen shrink-0 items-center sm:-mx-12 md:-mx-16">
              {renderTicker({ compact: true })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function AboutExperienceSlide() {
  return (
    <section className="absolute inset-0 grid items-center gap-10 px-8 py-16 sm:px-12 md:px-16 lg:grid-cols-[0.9fr_1fr]">
      <div className="absolute inset-0">
        <Image
          src={ABOUT_IMAGE_SRC}
          alt="Calmato experience background"
          fill
          className="object-cover opacity-35"
        />
      </div>
      <div className="absolute inset-0 bg-black/70" />
      <div className="absolute inset-0 bg-gradient-to-l from-black/86 via-black/45 to-black/72" />

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: "easeOut" }}
        className="relative z-10 max-w-[520px]"
      >
        <div className="mb-7 text-[13px] uppercase tracking-[0.42em] text-white/42">
          Experience
        </div>
        <h2 className="text-[42px] font-normal leading-[1.18] text-white sm:text-[54px]">
          Listen,
          <br />
          Archive,
          <br />
          and Leave
          <br />
          Your Day
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, ease: "easeOut", delay: 0.16 }}
        className="relative z-10 max-w-[560px] text-[14px] leading-8 text-white/78"
      >
        <p>
          Archive에서는 Calmato가 쌓아온 소리와 장면을 천천히 둘러보고,
          Community에서는 당신의 하루를 조용히 남길 수 있습니다.
        </p>
        <p className="mt-7">
          이곳은 음악을 소비하는 공간이기보다,
          하루의 결을 다시 듣고 정리하는 작은 방에 가깝습니다.
        </p>
        <div className="mt-8 h-px w-16 bg-white/32" />
        <p className="mt-8 text-white/88">
          오늘의 끝에, 당신에게 필요한 소리가 남아 있기를 바랍니다.
        </p>
      </motion.div>
    </section>
  );
}

export default function About() {
  const [index, setIndex] = useState(1);
  const [direction, setDirection] = useState(1);
  const [allowDrag, setAllowDrag] = useState(false);
  const [isPrincipleDetailOpen, setIsPrincipleDetailOpen] = useState(false);

  function goTo(nextIndex: number) {
    setDirection(nextIndex > index ? 1 : -1);
    setIndex(clampIndex(nextIndex));
  }

  function goNext() {
    setDirection(1);
    setIndex((current) => clampIndex(current + 1));
  }

  function goPrev() {
    setDirection(-1);
    setIndex((current) => clampIndex(current - 1));
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowRight") goNext();
      if (event.key === "ArrowLeft") goPrev();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");

    function syncAllowDrag() {
      setAllowDrag(media.matches);
    }

    syncAllowDrag();
    media.addEventListener("change", syncAllowDrag);
    return () => media.removeEventListener("change", syncAllowDrag);
  }, []);

  const slides = [
    <AboutPrinciplesSlide
      key="principles"
      onDetailChange={setIsPrincipleDetailOpen}
    />,
    <AboutIntroSlide key="intro" />,
    <AboutExperienceSlide key="experience" />,
  ];
  const exhibitionMode = index !== 1;
  const showSlideDots = !(index === 0 && isPrincipleDetailOpen);

  return (
    <>
      <Head>
        <title>About | Calmato</title>
      </Head>

      <main
        className={[
          "overflow-hidden text-white",
          exhibitionMode
            ? "fixed inset-0 z-[60] min-h-screen bg-[#0a0a0a]"
            : "relative min-h-[calc(100vh-144px)]",
        ].join(" ")}
      >
        {exhibitionMode && (
          <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-8 py-8 sm:px-12 md:px-16">
            <Link
              href="/"
              className="relative h-[80px] w-[160px] transition hover:opacity-80"
              aria-label="Calmato Home"
            >
              <Image
                src="/calmato_w_logo@4x.png"
                alt="Calmato Logo"
                fill
                priority
                className="object-contain"
              />
            </Link>

            <button
              type="button"
              onClick={() => goTo(1)}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.035] text-white/62 transition hover:border-white/28 hover:bg-white/[0.08] hover:text-white"
              aria-label="About 메인 페이지로 돌아가기"
            >
              <X size={19} strokeWidth={1.7} />
            </button>
          </div>
        )}

        <div
          className={[
            "absolute inset-x-0 bottom-0 overflow-x-hidden",
            exhibitionMode ? "top-36 overflow-y-auto" : "top-0 overflow-hidden",
          ].join(" ")}
        >
          <AnimatePresence custom={direction}>
            <motion.div
              key={index}
              custom={direction}
              initial={{ x: direction * 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -80, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
              drag={allowDrag ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.08}
              dragMomentum={false}
              onDragEnd={(_, info) => {
                if (info.offset.x < -80) goNext();
                if (info.offset.x > 80) goPrev();
              }}
              className={[
                "absolute inset-0 touch-pan-y",
                allowDrag ? "cursor-grab active:cursor-grabbing" : "",
              ].join(" ")}
            >
              {slides[index]}
            </motion.div>
          </AnimatePresence>
        </div>

        <button
          type="button"
          onClick={goPrev}
          className={[
            "group absolute left-0 z-20 hidden w-28 items-center justify-start pl-5 lg:flex",
            exhibitionMode ? "bottom-0 top-36" : "bottom-0 top-0",
          ].join(" ")}
          aria-label="이전 About 슬라이드"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/0 opacity-0 backdrop-blur-sm transition duration-200 group-hover:text-white/58 group-hover:opacity-100 hover:border-white/24 hover:text-white">
            <ChevronLeft size={22} strokeWidth={1.6} />
          </span>
        </button>
        <button
          type="button"
          onClick={goNext}
          className={[
            "group absolute right-0 z-20 hidden w-28 items-center justify-end pr-5 lg:flex",
            exhibitionMode ? "bottom-0 top-36" : "bottom-0 top-0",
          ].join(" ")}
          aria-label="다음 About 슬라이드"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/20 text-white/0 opacity-0 backdrop-blur-sm transition duration-200 group-hover:text-white/58 group-hover:opacity-100 hover:border-white/24 hover:text-white">
            <ChevronRight size={22} strokeWidth={1.6} />
          </span>
        </button>

        {showSlideDots && (
          <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3">
            {Array.from({ length: SLIDE_COUNT }).map((_, dotIndex) => (
              <button
                key={dotIndex}
                type="button"
                onClick={() => goTo(dotIndex)}
                className={[
                  "h-2 rounded-full transition-all",
                  dotIndex === index ? "w-8 bg-white/86" : "w-2 bg-white/28 hover:bg-white/48",
                ].join(" ")}
                aria-label={`About ${dotIndex + 1}번째 슬라이드로 이동`}
                aria-current={dotIndex === index}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
