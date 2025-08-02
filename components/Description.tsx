export default function DescriptionSection({ desc_kim, desc_lee }: { desc_kim: string; desc_lee: string }) {
  return (
    <div className="mt-4 max-w-5xl mx-auto space-y-12">
      {/* 영상 기획 의도 */}
      <div>
        <h3 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
           영상 기획 의도
        </h3>
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line subtext">
          {desc_kim}
        </p>
      </div>

      {/* 음악 기획 의도 */}
      <div>
        <h3 className="text-xl sm:text-2xl font-bold mb-4 flex items-center gap-2">
          음악 기획 의도
        </h3>
        <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line subtext">
          {desc_lee}
        </p>
      </div>
    </div>
  );
}
