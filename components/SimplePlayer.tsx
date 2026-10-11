import styles from "@/styles/archiveTracks.module.css";
import type { CSSProperties } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Pause, Play, Volume2, VolumeX } from "lucide-react";
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
};

interface Props {
  track: Track;
  onToggleDetails?: () => void;
  detailsOpen?: boolean;
  detailsId?: string;
  onPlaybackChange?: (state: { playing: boolean; progress: number }) => void;
  className?: string;
}

export default function SimplePlayer({
  track,
  onToggleDetails,
  detailsOpen = false,
  detailsId,
  onPlaybackChange,
  className = "",
}: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);
  const volumeButtonRef = useRef<HTMLButtonElement>(null);
  const sliderRef = useRef<HTMLInputElement>(null);
  const volumeId = useId();
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [playError, setPlayError] = useState(false);

  const syncPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const playing = !audio.paused && !audio.ended;
    setIsPlaying(playing);
    onPlaybackChange?.({
      playing,
      progress: Number.isFinite(audio.duration) && audio.duration > 0
        ? Math.min(1, Math.max(0, audio.currentTime / audio.duration))
        : 0,
    });
  };

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    setPlayError(false);
    if (!audio.paused) audio.pause();
    else {
      try {
        await audio.play();
      } catch {
        setPlayError(true);
        syncPlayback();
      }
    }
  };

  useEffect(() => {
    if (!volumeOpen) return;
    sliderRef.current?.focus({ preventScroll: true });
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !volumeRef.current?.contains(event.target)) {
        setVolumeOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [volumeOpen]);

  return (
    <div className={`${styles.player} ${className}`}>
      <audio
        ref={audioRef}
        src={getAudioUrl(track.audio_path) ?? "/audio/default.mp3"}
        preload="metadata"
        onPlay={syncPlayback}
        onPause={syncPlayback}
        onEnded={syncPlayback}
        onTimeUpdate={syncPlayback}
        onDurationChange={syncPlayback}
        onEmptied={syncPlayback}
        onVolumeChange={() => {
          const audio = audioRef.current;
          if (audio) setVolume(audio.muted ? 0 : audio.volume);
        }}
      />

      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "일시정지" : "재생"}
        className={styles.playButton}
        data-playing={isPlaying}
      >
        <span className={styles.playDisc}>
          {isPlaying ? <Pause size={15} strokeWidth={1.8} /> : <Play size={15} strokeWidth={1.8} className={styles.playIcon} />}
        </span>
      </button>

      <div
        ref={volumeRef}
        className={styles.volumeControl}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setVolumeOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setVolumeOpen(false);
            volumeButtonRef.current?.focus();
          }
        }}
      >
        <button
          ref={volumeButtonRef}
          type="button"
          onClick={() => setVolumeOpen((open) => !open)}
          aria-expanded={volumeOpen}
          aria-controls={volumeOpen ? volumeId : undefined}
          aria-label="음량 조절"
          className={styles.secondaryButton}
        >
          {volume === 0 ? <VolumeX size={17} strokeWidth={1.6} /> : <Volume2 size={17} strokeWidth={1.6} />}
        </button>
        {volumeOpen && (
          <div id={volumeId} className={styles.volumePopover}>
            <span className={styles.volumeValue} aria-hidden="true">{Math.round(volume * 100)}</span>
            <input
              ref={sliderRef}
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round(volume * 100)}
              aria-label="음량"
              aria-valuetext={`${Math.round(volume * 100)}%`}
              className={styles.volumeSlider}
              style={{ "--volume": `${volume * 100}%` } as CSSProperties}
              onChange={(event) => {
                const value = Number(event.target.value) / 100;
                const audio = audioRef.current;
                if (audio) {
                  audio.volume = value;
                  audio.muted = false;
                }
                setVolume(value);
              }}
            />
          </div>
        )}
      </div>

      {onToggleDetails && (
        <button
          type="button"
          aria-controls={detailsId}
          onClick={onToggleDetails}
          aria-expanded={detailsOpen}
          aria-label={detailsOpen ? "설명 닫기" : "설명 열기"}
          className={styles.secondaryButton}
        >
          <ChevronDown size={17} strokeWidth={1.6} className={`${styles.detailsChevron} ${detailsOpen ? styles.rotated : ""}`} />
        </button>
      )}
      {playError && <span role="status" className={styles.playerError}>재생할 수 없습니다. 다시 시도해 주세요.</span>}
    </div>
  );
}
