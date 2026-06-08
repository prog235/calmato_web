type Tab = "playlist" | "tracks" | "thumbnails" | "original";

type Props = {
  value: Tab;
  onChange: (v: Tab) => void;
};

export default function ArchiveTabs({ value, onChange }: Props) {
  const tabs: Tab[] = ["playlist", "tracks", "thumbnails", "original"];

  return (
    <div className="border-b border-white/20">
      <div className="flex items-center gap-9 text-[14px]">
        {tabs.map((t) => {
          const active = value === t;

          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t)}
              className={[
                "relative pb-3 capitalize transition",
                active
                  ? "font-bold text-white"
                  : "subtext hover:opacity-70",
              ].join(" ")}
            >
              {t}

              {active && (
                <span className="absolute left-0 bottom-[-1px] h-[2px] w-full bg-white/90" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
