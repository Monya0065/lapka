export default function SkeletonLoader({
  rows = 3,
  rowHeight = 'h-3',
  className = '',
  rounded = 'rounded-xl',
}) {
  const safeRows = Math.max(1, rows);
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: safeRows }).map((_, index) => (
        <div
          key={`skeleton-row-${index}`}
          className={`skeleton ${rounded} ${rowHeight} ${index === safeRows - 1 ? 'w-2/3' : 'w-full'}`}
        />
      ))}
    </div>
  );
}
