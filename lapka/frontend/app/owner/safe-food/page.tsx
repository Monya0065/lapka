import { redirect } from 'next/navigation';

export default function OwnerSafeFoodRedirectPage() {
  redirect('/owner/care?tab=food-safety');
}
