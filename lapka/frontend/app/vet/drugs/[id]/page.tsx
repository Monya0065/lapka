import dynamic from 'next/dynamic';

const DrugDetailsView = dynamic(() => import('@/components/drugs/DrugDetailsView'), {
  loading: () => (
    <div className="space-y-3">
      <div className="skeleton h-16 w-full" />
      <div className="skeleton h-96 w-full" />
    </div>
  ),
});

export default function VetDrugDetailsPage({ params, searchParams }) {
  return (
    <DrugDetailsView
      role="vet"
      drugId={params.id}
      listHref="/vet/drugs"
      detailBasePath="/vet/drugs"
      defaultVisitId={searchParams?.visit_id || ''}
    />
  );
}
