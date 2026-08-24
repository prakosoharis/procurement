import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../lib/current-user';
import { can, Permission } from '../../../../../lib/authorization/permissions';
import { listChatConversations } from '../../../../../lib/ai/chat/transcript-service';

// Lists chatbot conversation threads. Everyone with COPILOT_USE sees their own;
// ?userId=<id> is honoured only for actors with ACTIVITY_LOG_VIEW, matching how
// AuditLog visibility is already scoped elsewhere. This is a UAT-quality and
// audit log, not general chat history, so it is read-only.
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!can(user, Permission.COPILOT_USE)) return NextResponse.json({ error: 'Akses asisten tidak tersedia untuk peran ini.' }, { status: 403 });

  const userId = new URL(request.url).searchParams.get('userId');
  const conversations = await listChatConversations(user, { userId });
  return NextResponse.json({ conversations });
}
