import LoginPageClient from '@/components/blocks/LoginPageClient';

export default function LoginPage({ searchParams }) {
  return (
    <LoginPageClient
      role={searchParams?.role || 'owner'}
      nextUrl={searchParams?.next || ''}
    />
  );
}
