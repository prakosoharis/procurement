import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/current-user';
import { can, Permission } from '../../../../lib/authorization/permissions';
import { createAiService } from '../../../../lib/ai/ai-service';
import { answerChatQuestion } from '../../../../lib/ai/chat/chat-service';
import { aiErrorStatus, isAiServiceError } from '../../../../lib/ai/errors';

// Chatbot endpoint. Authentication and authorization run here, and the scoped
// retrieval inside the chat service runs before any provider call, so the model
// only ever receives data this actor is permitted to see.
export const dynamic = 'force-dynamic';

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!can(user, Permission.COPILOT_USE)) return NextResponse.json({ error: 'Akses asisten tidak tersedia untuk peran ini.' }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON tidak valid.' }, { status: 400 });
  }

  try {
    const result = await answerChatQuestion({
      actor: user,
      question: body?.question,
      history: body?.history,
      aiService: createAiService()
    });
    return NextResponse.json(result);
  } catch (error) {
    if (isAiServiceError(error)) {
      // Log the internal detail; return only the safe message and code.
      console.error('[ai:chat]', error.code, error.message);
      return NextResponse.json({ error: error.code, message: error.userMessage }, { status: aiErrorStatus[error.code] || 503 });
    }
    console.error('[ai:chat]', error);
    return NextResponse.json({ error: 'AI_PROVIDER_UNAVAILABLE', message: 'Layanan AI sedang tidak tersedia. Coba lagi nanti.' }, { status: 503 });
  }
}
