import { NextResponse } from 'next/server';
import { db } from '../../../../../lib/db';
import { currentUser } from '../../../../../lib/current-user';
import { writeAudit } from '../../../../../lib/documents';

const businessUnitResponses = new Set(['CONFIRMED', 'DECLINED']);

export async function PATCH(request, { params }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (user.role !== 'BUSINESS_UNIT_PIC') return NextResponse.json({ error: 'Hanya PIC Business Unit yang dapat merespons event.' }, { status: 403 });

  const { id } = await params;
  const { responseStatus } = await request.json();
  if (!businessUnitResponses.has(responseStatus)) return NextResponse.json({ error: 'Status respons tidak valid.' }, { status: 400 });

  const event = await db.auditEvent.findUnique({
    where: { id },
    select: { id: true, title: true, audience: true, status: true, participants: { where: { userId: user.id }, select: { userId: true } } }
  });
  if (!event) return NextResponse.json({ error: 'Event tidak ditemukan.' }, { status: 404 });
  if (event.status === 'CANCELLED') return NextResponse.json({ error: 'Event telah dibatalkan.' }, { status: 400 });
  if (event.audience === 'SELECTED_PICS' && !event.participants.length) return NextResponse.json({ error: 'Anda tidak terdaftar sebagai PIC pada event ini.' }, { status: 403 });

  const participant = await db.auditEventParticipant.upsert({
    where: { auditEventId_userId: { auditEventId: id, userId: user.id } },
    update: { responseStatus, respondedAt: new Date() },
    create: { auditEventId: id, userId: user.id, responseStatus, respondedAt: new Date() }
  });
  await writeAudit(user.id, 'AuditEvent', id, 'RESPOND_AUDIT_EVENT', JSON.stringify({ title: event.title, responseStatus }));
  return NextResponse.json(participant);
}
