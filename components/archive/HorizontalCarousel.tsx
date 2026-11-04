type Props = {
  children: React.ReactNode;
  className?: string;
};

export default function HorizontalCarousel({
  children,
  className = "",
}: Props) {
  return (
    <div
      className={`flex gap-4 overflow-x-auto pb-3 scroll-smooth hide-scrollbar ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}
