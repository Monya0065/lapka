import { redirect } from 'next/navigation';

export default function OwnerNutritionRedirectPage() {
  redirect('/owner/care?tab=nutrition');
}
