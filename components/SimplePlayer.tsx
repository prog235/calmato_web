// components/SimplePlayer.tsx
import { useEffect, useRef, useState } from "react";
import { FaPlay, FaPause, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { motion } from "framer-motion";

type Track = {
  id?: string;
  url?: string;
  title?: string;
  artist?: string;
  desc_kim?: string;
  desc_lee?: string;
  youtubeUrl?: string;
  thumbnail?: string;
};

interface Props {
  track: Track;
  // parent will control the expand panel
  onToggleDetails?: () => void;
  detailsOpen?: boolean;
  className?: string; // keep your pill/button styling intact
}

function TriangleDown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} width="18" height="18" aria-hidden>
      <path d="M7 10l5 5 5-5H7z" fill="currentColor" />
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, []);

  return (
    <div className={`flex items-center space-x-6 px-2 py-3 ${className}`}>
      {/* keep audio hidden inside the pill as before */}
      <audio ref={audioRef} src={track.url} preload="metadata" />

      <button onClick={togglePlay} aria-label={isPlaying ? "일시정지" : "재생"}>
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>

      <button onClick={toggleMute} aria-label={isMuted ? "음소거 해제" : "음소거"}>
        {isMuted ? <FaVolumeMute /> : <FaVolumeUp />}
      </button>

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
