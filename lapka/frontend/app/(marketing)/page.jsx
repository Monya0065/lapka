'use client';

import LandingHomePro from '@/components/marketing/LandingHomePro';

export default function LandingPage({ searchParams }) {
  const denied = searchParams?.access === 'denied';
  return <LandingHomePro showAccessDenied={denied} />;
}
