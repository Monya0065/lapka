'use client';

import AuthDropdown from '@/components/auth/AuthDropdown';
import StoreButtons from '@/components/marketing/StoreButtons';

export default function MarketingHeaderActions() {
  return (
    <div className="flex items-center gap-2">
      <StoreButtons compact className="hidden xl:flex" />
      <AuthDropdown mode="menu" />
    </div>
  );
}
