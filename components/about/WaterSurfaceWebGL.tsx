import { useRef } from "react";
import { useWaterRipples } from "./useWaterRipples";

export default function WaterSurfaceWebGL({
  backgroundSrc,
}: {
  backgroundSrc: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useWaterRipples(canvasRef, backgroundSrc);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 z-10 h-full w-full cursor-crosshair"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-white/[0.025] via-transparent to-black/[0.025]"
      />
    </>
  );
}
