import TopNavigation from '@/components/ui/TopNavigation';
import MarketingHeaderActions from '@/components/marketing/MarketingHeaderActions';

interface NavLink {
  href: string;
  labelKey: string;
}

const links: NavLink[] = [
  { href: '/', labelKey: 'nav.home' },
  { href: '/about', labelKey: 'nav.about' },
  { href: '/for-owners', labelKey: 'nav.forOwners' },
  { href: '/for-vets', labelKey: 'nav.forVets' },
  { href: '/for-clinics', labelKey: 'nav.forClinics' },
  { href: '/map', labelKey: 'nav.map' },
  { href: '/lost-pets', labelKey: 'nav.lostPets' },
  { href: '/security', labelKey: 'nav.security' },
  { href: '/privacy', labelKey: 'nav.privacy' },
  { href: '/terms', labelKey: 'nav.terms' },
  { href: '/pricing', labelKey: 'nav.pricing' },
  { href: '/faq', labelKey: 'nav.faq' }
];

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNavigation links={links} actions={<MarketingHeaderActions />} />
      {children}
    </>
  );
}
