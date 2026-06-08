import { motion } from "framer-motion";

type Props = {
  active: boolean;
  onClick: () => void;
  layoutId?: string;
};

export default function AmbientToggle({ active, onClick, layoutId }: Props) {
  return (
    <motion.button
      layoutId={layoutId}
      type="button"
      onClick={onClick}
      className={[
        "group fixed bottom-6 left-6 z-[70] flex h-8 w-8 items-center justify-center rounded-lg rounded-bl-none border transition",
        active
          ? "border-white bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.1)]"
          : "border-white bg-white text-black shadow-[0_10px_28px_rgba(255,255,255,0.08)] hover:bg-white/90",
      ].join(" ")}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ transformOrigin: "bottom left" }}
      transition={{
        layout: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
        opacity: { duration: 0.16, ease: "easeOut" },
      }}
      aria-label={active ? "Ambient Mixer 닫기" : "Ambient Mixer 열기"}
      aria-pressed={active}
    >
      <motion.span
        className="flex h-5 items-center gap-[2px]"
        aria-hidden="true"
        initial={{ opacity: 1, scale: 1 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.72 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      >
        {[15, 8, 18, 11, 16].map((height, index) => (
          <span
            key={`${height}_${index}`}
            className={[
              "block w-[2px] rounded-full transition",
              active ? "bg-black/70" : "bg-black/70 group-hover:bg-black",
            ].join(" ")}
            style={{ height }}
          />
        ))}
      </motion.span>
    </motion.button>
  );
}
