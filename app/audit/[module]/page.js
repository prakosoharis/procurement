import { notFound } from 'next/navigation';
import NativeAppShell from '../../components/native-app-shell';
import NativeModulePlaceholder from '../../components/native-module-placeholder';
import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';

const modules = {
  reviews: { title: 'Review Schedule', permission: Permission.AUDIT_VIEW, checkpoint: 'CP9', description: 'AuditReview will separate review/audit status from the SOP version lifecycle while preserving published SOP status.' },
  findings: { title: 'Findings', permission: Permission.FINDINGS_VIEW, checkpoint: 'CP9', description: 'Audit, operational, and governance findings will be managed separately from AI refinement findings.' },
  actions: { title: 'Action Tracking', permission: Permission.ACTIONS_VIEW, checkpoint: 'CP9', description: 'Follow-up ownership, due dates, and linked audit or governance findings will be consolidated here.' }
};

export const dynamic = 'force-dynamic';

export default async function AuditModule({ params }) {
  const { module } = await params;
  const definition = modules[module];
  if (!definition) notFound();
  const user = await requirePageAccess(definition.permission);
  return <NativeAppShell user={user}><NativeModulePlaceholder {...definition} legacyNote="Calendar and action features remain available in the legacy application during the native migration." /></NativeAppShell>;
}
