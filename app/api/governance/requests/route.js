import { db } from '../../../../lib/db';
import { actor, body, domain, error, json, serial } from '../../../../lib/api/governance';
import { fields } from '../../../../lib/api/mutation';
import { assertBusinessUnitScope } from '../../../../lib/authorization/scope';
import { can, Permission } from '../../../../lib/authorization/permissions';

const CREATE_REQUEST_FIELDS = [
  'title',
  'description',
  'sopDocumentId',
  'changeType',
  'clauseReference',
  'proposedText',
  'businessImpact',
  'priority',
  'conversionIntent',
  'requestedBusinessUnitId'
];

export async function GET() {
  try {
    const user = await actor();
    const where = user.role === 'BUSINESS_UNIT_PIC' ? { requesterId: user.id } : {};
    const rows = await db.sopRequest.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        requester: { select: { id: true, name: true } },
        sopDocument: { select: { id: true, title: true, businessUnit: { select: { id: true, name: true } } } }
      }
    });
    return json(serial(rows.map((row) => ({
      requestId: row.id,
      title: row.title,
      status: row.status,
      requestType: row.requestType,
      priority: row.priority,
      requester: row.requester,
      sop: row.sopDocument,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    }))));
  } catch (caught) {
    return error(caught);
  }
}

export async function POST(request) {
  try {
    const user = await actor();
    if (!can(user, Permission.SOP_REQUEST_CREATE)) {
      throw domain('FORBIDDEN', 'Your role cannot create submissions.');
    }

    const input = await body(request);
    fields(input, CREATE_REQUEST_FIELDS);
    if (!input.title || !input.description || !input.changeType || !input.clauseReference || !input.proposedText) {
      throw domain('MISSING_REQUIRED_METADATA', 'Required submission fields are missing.');
    }
    if (!['CREATE_SOP', 'CREATE_REVISION'].includes(input.conversionIntent)) {
      throw domain('INVALID_INPUT', 'A valid conversion intent is required.');
    }

    let sop = null;
    let requestedBusinessUnitId;
    if (input.conversionIntent === 'CREATE_SOP') {
      if (!input.requestedBusinessUnitId || input.sopDocumentId) {
        throw domain('MISSING_REQUIRED_METADATA', 'New SOP submissions require a Business Unit and no existing SOP.');
      }
      assertBusinessUnitScope(user, input.requestedBusinessUnitId);
      requestedBusinessUnitId = input.requestedBusinessUnitId;
    } else {
      if (!input.sopDocumentId) {
        throw domain('MISSING_REQUIRED_METADATA', 'Revision submissions require an existing SOP.');
      }
      sop = await db.sopDocument.findUnique({ where: { id: input.sopDocumentId } });
      if (!sop) throw domain('NOT_FOUND', 'SOP not found.');
      assertBusinessUnitScope(user, sop.businessUnitId);
      if (input.requestedBusinessUnitId && input.requestedBusinessUnitId !== sop.businessUnitId) {
        throw domain('INVALID_INPUT', 'Requested Business Unit does not match the target SOP.');
      }
      requestedBusinessUnitId = sop.businessUnitId;
    }

    const row = await db.sopRequest.create({
      data: {
        clientRequestKey: crypto.randomUUID(),
        title: input.title,
        requestType: input.conversionIntent === 'CREATE_SOP' ? 'NEW_SOP' : 'REVISION',
        description: input.description,
        sopDocumentId: sop?.id || null,
        requestedBusinessUnitId,
        conversionIntent: input.conversionIntent,
        changeType: input.changeType,
        clauseReference: input.clauseReference,
        proposedText: input.proposedText,
        businessImpact: input.businessImpact || null,
        priority: input.priority || 'MEDIUM',
        requesterId: user.id
      }
    });
    return json(serial({ requestId: row.id }), 201);
  } catch (caught) {
    return error(caught);
  }
}
