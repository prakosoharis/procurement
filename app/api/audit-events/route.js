import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';
import { currentUser } from '../../../lib/current-user';
import { writeAudit } from '../../../lib/documents';
import { startApiTiming } from '../../../lib/api-performance';

const calendarManagers = new Set(['SUPER_USER', 'CORPORATE_GOVERNANCE']);
const eventFormats = new Set(['ONSITE', 'REMOTE', 'HYBRID']);
const audiences = new Set(['SELECTED_PICS', 'ALL_BUSINESS_UNITS']);

const eventInclude = {
  businessUnit: { select: { id: true, name: true, groupName: true, industry: true } },
  createdBy: { select: { id: true, name: true } },
  participants: { include: { user: { select: { id: true, name: true, email: true, phone: true, jobTitle: true, businessUnitId: true } } } }
};

export async function GET() {
  const timing = startApiTiming('/api/audit-events');
  const user = await timing.measure('auth', () => currentUser());
  if (!user) return timing.apply(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));

  const isBusinessUnitUser = user.role === 'BUSINESS_UNIT_PIC';
  // Audit is private to explicitly invited PICs. General events, such as a
  // workshop, are intentionally visible to every Business Unit PIC.
  const where = isBusinessUnitUser ? {
    OR: [
      { audience: 'ALL_BUSINESS_UNITS' },
      { audience: 'SELECTED_PICS', participants: { some: { userId: user.id } } }
    ]
  } : {};
  const events = await timing.measure('db', () => db.auditEvent.findMany({ where, include: eventInclude, orderBy: { startAt: 'asc' } }));
  const now = new Date();
  const alerts = isBusinessUnitUser
    ? events.filter((event) => event.status !== 'CANCELLED' && (event.endAt || event.startAt) >= now)
    : [];

  return timing.apply(NextResponse.json({
    events,
    alerts,
    viewer: { id: user.id, role: user.role, businessUnitId: user.businessUnitId || null, canManage: calendarManagers.has(user.role) }
  }));
}

export async function POST(request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!calendarManagers.has(user.role)) return NextResponse.json({ error: 'Hanya Admin atau tim Compliance yang dapat membuat jadwal audit.' }, { status: 403 });

  const body = await request.json();
  const title = body.title?.trim();
  const agenda = body.agenda?.trim();
  const audience = body.audience || 'SELECTED_PICS';
  const businessUnitId = body.businessUnitId || null;
  const format = body.format || 'ONSITE';
  const location = body.location?.trim() || null;
  const startAt = new Date(body.startAt);
  const endAt = body.endAt ? new Date(body.endAt) : null;
  const participantIds = [...new Set((Array.isArray(body.participantIds) ? body.participantIds : []).filter(Boolean))];

  if (!title || !agenda || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: 'Judul, agenda, dan jadwal mulai wajib diisi.' }, { status: 400 });
  }
  if (!eventFormats.has(format)) return NextResponse.json({ error: 'Format audit tidak valid.' }, { status: 400 });
  if (!audiences.has(audience)) return NextResponse.json({ error: 'Jenis akses event tidak valid.' }, { status: 400 });
  if (audience === 'SELECTED_PICS' && !participantIds.length) return NextResponse.json({ error: 'Pilih minimal satu PIC untuk audit privat.' }, { status: 400 });
  if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= startAt)) return NextResponse.json({ error: 'Waktu selesai harus setelah waktu mulai.' }, { status: 400 });

  const [businessUnit, participants] = await Promise.all([
    businessUnitId ? db.businessUnit.findUnique({ where: { id: businessUnitId } }) : null,
    participantIds.length ? db.user.findMany({ where: { id: { in: participantIds }, role: 'BUSINESS_UNIT_PIC' }, select: { id: true } }) : []
  ]);
  if (businessUnitId && !businessUnit) return NextResponse.json({ error: 'Business Unit tujuan tidak ditemukan.' }, { status: 404 });
  if (participants.length !== participantIds.length) return NextResponse.json({ error: 'Satu atau lebih PIC tidak ditemukan di Directory.' }, { status: 400 });

  const event = await db.auditEvent.create({
    data: {
      businessUnitId, title, agenda, audience, format, location, startAt, endAt, createdById: user.id,
      participants: { create: participants.map((participant) => ({ userId: participant.id })) }
    },
    include: eventInclude
  });
  await writeAudit(user.id, 'AuditEvent', event.id, 'CREATE_AUDIT_EVENT', JSON.stringify({ audience, businessUnit: businessUnit?.name || 'Semua Business Unit', startAt: event.startAt, participantCount: participants.length }));
  return NextResponse.json(event, { status: 201 });
}
