import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  speed?: number; // wheel sensitivity
};

export default function HorizontalCarousel({ children, className = "", speed = 2 }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // If user is doing a horizontal gesture on trackpad, let browser handle it.
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;

      const delta = e.deltaY;
      if (delta === 0) return;

      const atStart = el.scrollLeft <= 0;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      const goingLeft = delta < 0;

      const canScroll = (!atStart && goingLeft) || (!atEnd && !goingLeft);

      // Only block vertical scroll when we can scroll horizontally
      if (canScroll) {
        e.preventDefault();
        el.scrollLeft += delta * speed;
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [speed]);

  return (
    <div
      ref={ref}
      className={`flex gap-4 overflow-x-auto pb-3 scroll-smooth hide-scrollbar horizontal-scroll-lock ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}
