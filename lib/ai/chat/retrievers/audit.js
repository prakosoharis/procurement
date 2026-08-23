import { Role } from '../../../authorization/roles.js';

// Mirrors the calendar read rule exactly: an audit appointment is private to
// explicitly invited PICs, while a general event is visible to every Business
// Unit PIC. Business Unit scope alone is NOT sufficient here.
export async function retrieveAudit({ actor, db, limit = 25 }) {
  const where = actor?.role === Role.BUSINESS_UNIT
    ? {
        OR: [
          { audience: 'ALL_BUSINESS_UNITS' },
          { audience: 'SELECTED_PICS', participants: { some: { userId: actor.id } } }
        ]
      }
    : {};

  const events = await db.auditEvent.findMany({
    where,
    select: {
      id: true, title: true, agenda: true, format: true, audience: true, location: true,
      startAt: true, endAt: true, status: true,
      businessUnit: { select: { name: true } },
      participants: { select: { responseStatus: true } }
    },
    orderBy: { startAt: 'desc' },
    take: limit
  });

  return {
    topic: 'audit',
    records: events.map((event) => ({
      type: 'AUDIT_EVENT',
      id: event.id,
      label: event.title,
      agenda: event.agenda,
      format: event.format,
      audience: event.audience,
      location: event.location,
      businessUnit: event.businessUnit?.name || null,
      status: event.status,
      startAt: event.startAt,
      endAt: event.endAt,
      participantCount: event.participants.length,
      confirmedCount: event.participants.filter((participant) => ['CONFIRMED', 'ATTENDED'].includes(participant.responseStatus)).length
    }))
  };
}
