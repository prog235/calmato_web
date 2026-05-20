import { useEffect, useRef } from "react";

type Props = {
  children: React.ReactNode;
  className?: string;
  speed?: number; // mouse wheel sensitivity
};

export default function HorizontalCarousel({
  children,
  className = "",
  speed = 2,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      // 1) 트랙패드/가로 제스처로 보이는 입력은 그대로 둠
      //    (deltaX가 섞여 있거나 ctrlKey 등이 들어오는 경우도 건드리지 않음)
      if (Math.abs(e.deltaX) > 0 || e.ctrlKey) return;

      // 2) 세로 휠이 거의 없는 경우 무시
      if (e.deltaY === 0) return;

      const maxScrollLeft = el.scrollWidth - el.clientWidth;

      // 3) 가로 스크롤 자체가 필요 없는 경우
      if (maxScrollLeft <= 0) return;

      const current = el.scrollLeft;
      const next = current + e.deltaY * speed;

      // 4) 마우스 휠일 때만 세로 -> 가로 전환
      //    단, 더 이상 진행 불가능한 끝에서는 preventDefault 하지 않아서
      //    페이지 세로 스크롤이 다시 살아나게 함.

      // 왼쪽/오른쪽으로 아직 더 갈 수 있는 중간 구간
      if (next > 0 && next < maxScrollLeft) {
        e.preventDefault();
        el.scrollLeft = next;
        return;
      }

      // 왼쪽 끝 직전에서 마지막 이동만 처리
      if (next <= 0 && current > 0) {
        e.preventDefault();
        el.scrollLeft = 0;
        return;
      }

      // 오른쪽 끝 직전에서 마지막 이동만 처리
      if (next >= maxScrollLeft && current < maxScrollLeft) {
        e.preventDefault();
        el.scrollLeft = maxScrollLeft;
        return;
      }

      // 이미 양 끝에 도달한 상태라면 막지 않음
      // -> 페이지 세로 스크롤 허용
    };

    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
    };
  }, [speed]);

  return (
    <div
      ref={ref}
      className={`flex gap-4 overflow-x-auto pb-3 scroll-smooth hide-scrollbar ${className}`}
      style={{
        WebkitOverflowScrolling: "touch",
        touchAction: "pan-y", // 모바일/터치에서는 세로 스크롤 우선
      }}
    >
      {children}
    </div>
  );
}