import { NextResponse } from 'next/server';
import { currentUser } from '../../../../lib/current-user';
import { can, Permission } from '../../../../lib/authorization/permissions';
import { createAiService } from '../../../../lib/ai/ai-service';
import { aiErrorStatus, isAiServiceError } from '../../../../lib/ai/errors';

// Superuser-only operational check. It makes one small provider request and
// returns configuration state; it never returns a key, token, or raw provider
// payload.
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!can(user, Permission.SETTINGS_MANAGE)) return NextResponse.json({ error: 'Super User access required' }, { status: 403 });

  try {
    const health = await createAiService().healthCheck();
    return NextResponse.json(health, { status: health.ok ? 200 : 503 });
  } catch (error) {
    if (isAiServiceError(error)) {
      console.error('[ai:health]', error.code, error.message);
      return NextResponse.json({ ok: false, error: error.code, message: error.userMessage }, { status: aiErrorStatus[error.code] || 503 });
    }
    console.error('[ai:health]', error);
    return NextResponse.json({ ok: false, error: 'AI_PROVIDER_UNAVAILABLE' }, { status: 503 });
  }
}
