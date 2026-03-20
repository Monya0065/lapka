import OwnerPetTabs from '@/components/ui/OwnerPetTabs';

export default function OwnerPetLayout({ children, params }) {
  const id = params.id;

  return (
    <div className="space-y-4">
      <OwnerPetTabs id={id} />
      {children}
    </div>
  );
}
