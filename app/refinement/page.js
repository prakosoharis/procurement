import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/**
 * Preserves links to the former prototype route while sending users to the
 * native, server-authorized Human-Only Refinement workspace.
 */
export default function LegacyRefinementRoute() {
  redirect('/sop-governance/refinement');
}
