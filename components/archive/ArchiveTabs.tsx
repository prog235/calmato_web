type Tab = "playlist" | "tracks" | "thumbnails" | "original";

type Props = {
  value: Tab;
  onChange: (v: Tab) => void;
};

export default function ArchiveTabs({ value, onChange }: Props) {
  const tabs: Tab[] = ["playlist", "tracks", "thumbnails", "original"];

  return (
    <div className="flex space-x-6 text-[16px]">
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onChange(t)}
          className={`capitalize ${
            value === t ? "font-bold border-b" : "subtext"
          } hover:opacity-70 transition`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
