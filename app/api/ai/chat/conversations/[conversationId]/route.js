import { NextResponse } from 'next/server';
import { currentUser } from '../../../../../../lib/current-user';
import { can, Permission } from '../../../../../../lib/authorization/permissions';
import { getChatConversation } from '../../../../../../lib/ai/chat/transcript-service';

// A single conversation's transcript. Ownership or ACTIVITY_LOG_VIEW is
// required; a conversation belonging to another user without that permission
// is reported as 404, not 403, so its existence is not disclosed either.
export const dynamic = 'force-dynamic';

export async function GET(_, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!can(user, Permission.COPILOT_USE)) return NextResponse.json({ error: 'Akses asisten tidak tersedia untuk peran ini.' }, { status: 403 });

  const { conversationId } = await params;
  const conversation = await getChatConversation(user, conversationId);
  if (!conversation) return NextResponse.json({ error: 'Percakapan tidak ditemukan' }, { status: 404 });
  return NextResponse.json({ conversation });
}
