import { notFound } from 'next/navigation';
import NativeAppShell from '../../components/native-app-shell';
import NativeModulePlaceholder from '../../components/native-module-placeholder';
import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';

const modules = {
  references: { title: 'Reference Library', permission: Permission.REFERENCES_VIEW, checkpoint: 'CP3–CP6', description: 'Approved governance references will become the shared knowledge foundation for repository, refinement, and copilot.' },
  'business-units': { title: 'Business Units', permission: Permission.BUSINESS_UNITS_VIEW, checkpoint: 'CP2', description: 'Business Unit scope, ownership, and configurable review policy will be managed here.' },
  users: { title: 'Users & Roles', permission: Permission.USERS_MANAGE, checkpoint: 'CP2', description: 'The simplified four-role model and future multi-BU access scope will be managed here.' },
  'activity-log': { title: 'Activity Log', permission: Permission.ACTIVITY_LOG_VIEW, checkpoint: 'CP11–CP12', description: 'Traceable governance activity, approvals, overrides, and AI operational events will be displayed here.' }
};

export const dynamic = 'force-dynamic';

export default async function GovernanceModule({ params }) {
  const { module } = await params;
  const definition = modules[module];
  if (!definition) notFound();
  const user = await requirePageAccess(definition.permission);
  return <NativeAppShell user={user}><NativeModulePlaceholder {...definition} legacyNote="No existing governance data or administration behavior is changed by CP1." /></NativeAppShell>;
}
