import SkeletonLoader from '@/components/ui/SkeletonLoader';

export default function Skeleton({ className = 'h-24 w-full' }) {
  if (className.includes('h-') || className.includes('w-')) {
    return <div className={`skeleton ${className}`} />;
  }
  return <SkeletonLoader className={className} />;
}
