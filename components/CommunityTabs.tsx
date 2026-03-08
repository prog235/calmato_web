// src/components/community/CommunityTabs.tsx
import Link from "next/link";

type CommunityTabKey = "board" | "request";

type CommunityTabsProps = {
  current: CommunityTabKey;
};

export default function CommunityTabs({ current }: CommunityTabsProps) {
  const tabs = [
    { key: "board" as const, label: "자유 게시판", href: "/community/board" },
    { key: "request" as const, label: "곡 신청", href: "/community/request" },
  ];

  return (
    <div className="border-b border-white/20">
      <div className="flex items-center gap-8 text-sm">
        {tabs.map((tab) => {
          const active = tab.key === current;

          return (
            <Link
              key={tab.key}
              href={tab.href}
              className={[
                "relative pb-3 transition",
                active
                  ? "font-semibold text-white"
                  : "text-white/60 hover:text-white/80",
              ].join(" ")}
            >
              {tab.label}

              {active && (
                <span className="absolute left-0 bottom-[-1px] h-[2px] w-full bg-white/90" />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}