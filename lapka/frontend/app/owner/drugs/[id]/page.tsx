import dynamic from 'next/dynamic';

const DrugDetailsView = dynamic(() => import('@/components/drugs/DrugDetailsView'), {
  loading: () => (
    <div className="space-y-3">
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-96 w-full" />
    </div>
  ),
});

export default function OwnerDrugDetailsPage({ params }) {
  return (
    <DrugDetailsView
      role="owner"
      drugId={params.id}
      listHref="/owner/pharmacy"
      detailBasePath="/owner/drugs"
    />
  );
}
