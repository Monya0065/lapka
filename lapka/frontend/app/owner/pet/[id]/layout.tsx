import OwnerPetTabs from '@/components/ui/OwnerPetTabs';
import OwnerPetSwitcher from '@/components/ui/OwnerPetSwitcher';

export default function OwnerPetLayout({ children, params }) {
  const id = params.id;

  return (
    <div className="space-y-4">
      <OwnerPetSwitcher currentPetId={id} />
      <OwnerPetTabs id={id} />
      {children}
    </div>
  );
}
