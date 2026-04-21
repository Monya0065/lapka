import dynamic from 'next/dynamic';

const DrugFinder = dynamic(() => import('@/components/drugs/DrugFinder'), {
  loading: () => (
    <div className="space-y-3">
      <div className="skeleton h-20 w-full" />
      <div className="skeleton h-80 w-full" />
    </div>
  ),
});

export default function VetDrugsPage() {
  return (
    <DrugFinder
      role="vet"
      detailBasePath="/vet/drugs"
    />
  );
}
