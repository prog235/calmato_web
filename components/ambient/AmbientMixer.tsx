import { AnimatePresence, motion } from "framer-motion";
import { Pause, Play, X } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import {
  AmbientChannel,
  AmbientChannelId,
  AmbientVolumeId,
  buildAmbientImageUrl,
  useAmbientMixer,
} from "@/hooks/useAmbientMixer";
import styles from "@/styles/AmbientMixer.module.css";

const surfaceTransition = {
  duration: 0.54,
  ease: [0.22, 1, 0.36, 1],
} as const;

const openSurfaceTransition = {
  default: surfaceTransition,
  backgroundColor: { duration: 0.1, ease: "easeOut" },
  borderColor: { duration: 0.1, ease: "easeOut" },
} as const;

const closeSurfaceTransition = {
  default: surfaceTransition,
  backgroundColor: { duration: 0.12, delay: 0.38, ease: "easeOut" },
  borderColor: { duration: 0.12, delay: 0.38, ease: "easeOut" },
} as const;

const MIXER_MAX_WIDTH = 592;

type ChannelCardProps = {
  channel: AmbientChannel | { id: "all"; label: "All"; color: string };
  active: boolean;
  volume: number;
  onVolumeChange: (value: number) => void;
  onToggle: () => void;
};

function ChannelArtwork({
  channel,
  active,
}: {
  channel: AmbientChannel | { id: "all"; label: "All"; color: string };
  active: boolean;
}) {
  const imageUrl = channel.id !== "all" ? buildAmbientImageUrl(channel) : null;

  if (channel.id === "all") {
    return (
      <div className="flex h-[48px] w-[48px] items-center justify-center">
        {active ? (
          <Pause size={22} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={22} fill="currentColor" strokeWidth={0} className="ml-1" />
        )}
      </div>
    );
  }

  return (
    <div
      className={[
        "relative flex h-[48px] w-[48px] items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br",
        channel.color,
      ].join(" ")}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.38),transparent_22%),radial-gradient(circle_at_70%_75%,rgba(255,255,255,0.16),transparent_26%)]" />
      )}
      <div className="absolute inset-0 bg-black/20" />
      {active ? (
        <Pause size={22} fill="currentColor" strokeWidth={0} className="relative" />
      ) : (
        <Play size={22} fill="currentColor" strokeWidth={0} className="relative ml-1" />
      )}
    </div>
  );
}

function ChannelCard({
  channel,
  active,
  volume,
  onVolumeChange,
  onToggle,
}: ChannelCardProps) {
  return (
    <div
      className={[
        "flex h-[260px] w-[68px] shrink-0 flex-col items-center rounded-full border px-2.5 py-6 transition",
        active
          ? "border-white/18 bg-white/[0.105]"
          : "border-white/8 bg-white/[0.055] hover:border-white/14 hover:bg-white/[0.075]",
      ].join(" ")}
    >
      <div className="mb-3 font-serif text-[14px] leading-none text-white">
        {channel.label}
      </div>

      <div
        className="relative mt-3 mb-4 flex h-[116px] w-7 items-center justify-center"
        style={{ "--ambient-volume": `${volume * 100}%` } as CSSProperties}
      >
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-0 h-full w-[6px] -translate-x-1/2 rounded-full bg-black/45 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),inset_0_-1px_2px_rgba(0,0,0,0.45)]"
        />
        <span
          aria-hidden="true"
          className="absolute bottom-0 left-1/2 h-[var(--ambient-volume)] w-[6px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.14)]"
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(event) => onVolumeChange(Number(event.target.value))}
          className={`${styles.volumeRange} relative z-10 h-[116px] w-7 cursor-pointer`}
          style={{
            writingMode: "vertical-lr",
            direction: "rtl",
          }}
          aria-label={`${channel.label} volume`}
        />
      </div>

      <button
        type="button"
        onClick={onToggle}
        className="relative mt-auto translate-y-1.5 rounded-full text-white/95 transition hover:scale-105 hover:text-white"
        aria-label={active ? `${channel.label} 일시정지` : `${channel.label} 재생`}
        aria-pressed={active}
      >
        <ChannelArtwork channel={channel} active={active} />
      </button>
    </div>
  );
}

export default function AmbientMixer() {
  const [open, setOpen] = useState(false);
  const [panelWidth, setPanelWidth] = useState(MIXER_MAX_WIDTH);
  const mixer = useAmbientMixer();

  useEffect(() => {
    const updatePanelWidth = () => {
      setPanelWidth(Math.min(MIXER_MAX_WIDTH, window.innerWidth - 48));
    };

    updatePanelWidth();
    window.addEventListener("resize", updatePanelWidth);

    return () => window.removeEventListener("resize", updatePanelWidth);
  }, []);

  const openPanel = async () => {
    setOpen((prev) => !prev);
    await mixer.resume();
  };

  const closePanel = () => {
    setOpen(false);
  };

  const allChannel = {
    id: "all",
    label: "All",
    color: "from-white/20 via-white/10 to-black",
  } as const;

  return (
    <>
      <AnimatePresence>
        {open ? (
          <motion.button
            type="button"
            className="fixed inset-0 z-[80] cursor-default bg-black/30 backdrop-blur-[1px]"
            aria-label="Ambient Mixer 닫기"
            onClick={closePanel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          />
        ) : null}
      </AnimatePresence>

      <motion.div
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Ambient Mixer" : undefined}
        className="fixed bottom-6 left-6 z-[90] overflow-hidden border backdrop-blur-md"
        initial={false}
        animate={{
          width: open ? panelWidth : 32,
          height: open ? 344 : 32,
          paddingRight: open ? 18 : 0,
          paddingBottom : open ? 20 : 0,
          paddingTop: open ? 20 : 0,
          paddingLeft: open? 20 : 0,
          backgroundColor: open ? "rgba(13, 13, 13, 0.92)" : "rgba(255, 255, 255, 1)",
          borderColor: open ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 1)",
          borderTopLeftRadius: open ? 30 : 8,
          borderTopRightRadius: open ? 30 : 8,
          borderBottomRightRadius: open ? 30 : 8,
          borderBottomLeftRadius: 0,
          boxShadow: open
            ? "0 24px 70px rgba(0,0,0,0.58)"
            : "0 10px 28px rgba(255,255,255,0.08)",
        }}
        style={{ transformOrigin: "bottom left" }}
        transition={open ? openSurfaceTransition : closeSurfaceTransition}
      >
        <AnimatePresence initial={false}>
          {!open ? (
            <motion.button
              key="ambient-toggle"
              type="button"
              onClick={openPanel}
              className="absolute inset-0 flex items-center justify-center text-black transition hover:bg-white/90"
              aria-label="Ambient Mixer 열기"
              aria-pressed={mixer.anyPlaying}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                transition: {
                  duration: 0.14,
                  delay: 0.38,
                  ease: [0.22, 1, 0.36, 1],
                },
              }}
              exit={{
                opacity: 0,
                transition: {
                  duration: 0.08,
                  ease: "easeOut",
                },
              }}
            >
              <span className="flex h-5 items-center gap-[2px]" aria-hidden="true">
                {[15, 8, 18, 11, 16].map((height, index) => (
                  <span
                    key={`${height}_${index}`}
                    className={[
                      styles.toggleWaveBar,
                      "block w-[2px] rounded-full bg-black/70 transition",
                      mixer.anyPlaying ? styles.toggleWaveBarPlaying : "",
                    ].join(" ")}
                    style={
                      {
                        "--bar-height": `${height}px`,
                        "--bar-delay": `${index * 0.11}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
            </motion.button>
          ) : (
            <motion.div
              key="ambient-panel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.2,
                delay: 0.16,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <button
                type="button"
                onClick={closePanel}
                className="absolute right-5 top-4 flex h-7 w-7 items-center justify-center text-white/68 transition hover:text-white"
                aria-label="Ambient Mixer 닫기"
              >
                <X size={18} />
              </button>

              <p className="pl-3 pr-10 text-[12px] text-white/58">
                좋아하는 소리와 함께 둘러보세요.
              </p>

              <div className="mt-5 flex gap-3 overflow-x-auto pb-1">
                <ChannelCard
                  channel={allChannel}
                  active={mixer.anyPlaying}
                  volume={mixer.volumes.all}
                  onVolumeChange={(value) => mixer.setVolume("all", value)}
                  onToggle={mixer.toggleAll}
                />

                {mixer.channels.map((channel) => (
                  <ChannelCard
                    key={channel.id}
                    channel={channel}
                    active={mixer.playing[channel.id]}
                    volume={mixer.volumes[channel.id]}
                    onVolumeChange={(value) =>
                      mixer.setVolume(channel.id as AmbientVolumeId, value)
                    }
                    onToggle={() => mixer.toggleChannel(channel.id as AmbientChannelId)}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
