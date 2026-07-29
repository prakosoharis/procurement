import { notFound } from 'next/navigation';
import NativeAppShell from '../../components/native-app-shell';
import NativeModulePlaceholder from '../../components/native-module-placeholder';
import { requirePageAccess } from '../../../lib/authorization/require-user';
import { Permission } from '../../../lib/authorization/permissions';

const modules = {
  repository: { title: 'SOP Repository', permission: Permission.SOP_REPOSITORY_VIEW, checkpoint: 'CP3', description: 'The official SOP library, version governance, metadata, document access, and lifecycle view will be implemented here.' },
  requests: { title: 'SOP Requests', permission: Permission.SOP_REQUEST_VIEW, checkpoint: 'CP4', description: 'Business Unit submissions, revision requests, conversation, and governance routing will be migrated here.' },
  refinement: { title: 'SOP Refinement', permission: Permission.REFINEMENT_VIEW, checkpoint: 'CP6–CP7', description: 'Structured AI-assisted refinement will be introduced only after the AI abstraction and governance data contracts are ready.' },
  validation: { title: 'Validation', permission: Permission.VALIDATION_VIEW, checkpoint: 'CP8', description: 'Human governance decisions, comments, and return-to-refinement workflow will be implemented here.' },
  publish: { title: 'Publish', permission: Permission.PUBLISH_VIEW, checkpoint: 'CP8', description: 'The iMemo publishing abstraction and controlled manual publishing status will be implemented here.' }
};

export const dynamic = 'force-dynamic';

export default async function SopGovernanceModule({ params }) {
  const { module } = await params;
  const definition = modules[module];
  if (!definition) notFound();
  const user = await requirePageAccess(definition.permission);
  return <NativeAppShell user={user}><NativeModulePlaceholder {...definition} legacyNote="Existing repository, submission, refinement, and validation features remain in the legacy application until the corresponding native module is ready." /></NativeAppShell>;
}
