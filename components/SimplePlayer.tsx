// components/SimplePlayer.tsx
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { motion } from "framer-motion";
import { getAudioUrl } from "@/lib/getUrl";

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
  // parent will control the expand panel
  onToggleDetails?: () => void;
  detailsOpen?: boolean;
  className?: string; // keep your pill/button styling intact
}

function TriangleDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="24" height="24" aria-hidden>
      <path d="M4.5 8.5 12 16l7.5-7.5h-15z" fill="currentColor" />
    </svg>
  );
}

export default function SimplePlayer({
  track,
  onToggleDetails,
  detailsOpen = false,
  className = "",
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const toggleVolumeSlider = () => {
    setVolumeOpen((open) => !open);
  };

  const updateVolume = (value: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.volume = value;
      audio.muted = false;
    }
    setVolume(value);
  };

  const updateVolumeFromPointer = (clientY: number) => {
    const trackEl = volumeTrackRef.current;
    if (!trackEl) return;

    const rect = trackEl.getBoundingClientRect();
    const nextVolume = (rect.bottom - clientY) / rect.height;
    updateVolume(Math.min(1, Math.max(0, nextVolume)));
  };

  const nudgeVolume = (delta: number) => {
    updateVolume(Math.min(1, Math.max(0, volume + delta)));
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onVolumeChange = () => setVolume(audio.muted ? 0 : audio.volume);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("volumechange", onVolumeChange);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("volumechange", onVolumeChange);
    };
  }, []);

  return (
    
    <div className={`flex items-center gap-8 pl-3 pr-2 py-3 ${className}`}>
      {/* keep audio hidden inside the pill as before */}
      <audio ref={audioRef} src={getAudioUrl(track.audio_path) ?? "/audio/default.mp3"} preload="metadata" />

      <button onClick={togglePlay} aria-label={isPlaying ? "일시정지" : "재생"}>
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>

      <div className="relative flex items-center">
        <button
          onClick={toggleVolumeSlider}
          aria-expanded={volumeOpen}
          aria-label="음량 조절"
        >
          {volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}
        </button>

        {volumeOpen && (
          <div
            className="absolute bottom-full left-1/2 z-30 mb-3 flex h-36 w-12 -translate-x-1/2 items-center justify-center rounded-[24px] border border-white/15 bg-zinc-800/90 px-3 py-6 shadow-[0_14px_36px_rgba(0,0,0,0.35)] backdrop-blur-md"
            style={
              {
                "--track-volume": `${volume * 96}px`,
                "--thumb-bottom": `${volume * 96 - 11}px`,
              } as CSSProperties
            }
          >
            <div
              ref={volumeTrackRef}
              role="slider"
              tabIndex={0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(volume * 100)}
              aria-label="음량"
              className="relative h-24 w-7 cursor-pointer touch-none outline-none"
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                updateVolumeFromPointer(e.clientY);
              }}
              onPointerMove={(e) => {
                if (e.buttons !== 1) return;
                updateVolumeFromPointer(e.clientY);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowUp" || e.key === "ArrowRight") {
                  e.preventDefault();
                  nudgeVolume(0.05);
                }
                if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
                  e.preventDefault();
                  nudgeVolume(-0.05);
                }
                if (e.key === "Home") {
                  e.preventDefault();
                  updateVolume(0);
                }
                if (e.key === "End") {
                  e.preventDefault();
                  updateVolume(1);
                }
              }}
            >
              <span
                aria-hidden="true"
                className="absolute left-1/2 top-0 h-full w-[6px] -translate-x-1/2 rounded-full bg-black/55 shadow-[inset_0_1px_2px_rgba(255,255,255,0.05),inset_0_-1px_2px_rgba(0,0,0,0.45)]"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-[var(--track-volume)] max-h-24 w-[6px] -translate-x-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.14)]"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-[var(--thumb-bottom)] left-1/2 h-[22px] w-3 -translate-x-1/2 rounded-[2px] border border-white/55 bg-[linear-gradient(180deg,rgba(235,235,235,0.98),rgba(203,203,203,0.98))] shadow-[0_1px_2px_rgba(0,0,0,0.28),0_6px_14px_rgba(0,0,0,0.38),0_0_0_1px_rgba(255,255,255,0.08)]"
              />
            </div>
          </div>
        )}
      </div>

      {/* ellipsis -> triangle; only rotates & calls parent */}
      <motion.button
        onClick={onToggleDetails}
        aria-expanded={detailsOpen}
        aria-label={detailsOpen ? "설명 닫기" : "설명 열기"}
        className="rounded-md hover:bg-black/10"
        animate={{ rotate: detailsOpen ? 180 : 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <TriangleDown />
      </motion.button>
    </div>
  );
}
