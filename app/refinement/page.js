import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function LegacyRefinementRoute() {
  redirect('/hub/refinement');
}
