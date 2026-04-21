import dynamic from 'next/dynamic';
import Skeleton from '@/components/ui/Skeleton';

const CalculatorSuite = dynamic(() => import('@/components/features/CalculatorSuite'), {
  loading: () => (
    <div className="space-y-3">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  ),
});

export default function VetToolsPage() {
  return <CalculatorSuite embedded={false} title="Клинические калькуляторы" />;
}
