import PublicRxClientPage from './public-rx-client';

export const metadata = {
  title: 'Lapka · Public Prescription',
  robots: {
    index: false,
    follow: false,
  },
};

export default function PublicPrescriptionPage({ params }) {
  return <PublicRxClientPage token={params?.token || ''} />;
}
