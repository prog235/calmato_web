import { useRef, useState } from "react";
import { FaPlay, FaPause, FaVolumeUp, FaEllipsisV } from "react-icons/fa";

interface Props {
  src: string;
}

export default function CustomAudioPlayer({ src }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.muted = !audio.muted;
    }
  };

  return (
    <div className="flex items-center space-x-6">
      <audio ref={audioRef} src={src} />

      <button onClick={togglePlay}>
        {isPlaying ? <FaPause /> : <FaPlay />}
      </button>

      <button onClick={toggleMute}>
        <FaVolumeUp />
      </button>

      <button>
        <FaEllipsisV />
      </button>
    </div>
  );
}
