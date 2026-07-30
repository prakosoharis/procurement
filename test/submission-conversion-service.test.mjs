import assert from 'node:assert/strict';
import test from 'node:test';
import { convertApprovedSubmission } from '../lib/governance/requests/submission-conversion-service.js';

const actor = { id: 'procurement-1', role: 'CORPORATE_GOVERNANCE' };
const timestamp = new Date('2026-07-30T00:00:00.000Z');

function approvedSubmission(overrides = {}) {
  return {
    id: 'submission-1',
    status: 'APPROVED',
    updatedAt: timestamp,
    title: 'Update procurement policy',
    description: 'Business context',
    proposedText: 'Proposed controlled change',
    conversionIntent: 'CREATE_SOP',
    requestedBusinessUnitId: 'bu-1',
    sopDocumentId: null,
    sopDocument: null,
    ...overrides
  };
}

function makeDb({
  submission,
  sourceVersion = null,
  existingConversion = null,
  raceConversion = null,
  failAudit = false
}) {
  const state = {
    documents: [],
    versions: sourceVersion ? [sourceVersion] : [],
    conversions: existingConversion ? [existingConversion] : [],
    audit: [],
    transactionOptions: null
  };
  let sequence = 0;

  function txFor(draft) {
    return {
      sopRequest: { findUnique: async () => draft.submission },
      sopDocument: {
        create: async ({ data }) => {
          const row = { id: `document-${++sequence}`, ...data };
          draft.documents.push(row);
          return row;
        }
      },
      sopVersion: {
        findUnique: async () => draft.sourceVersion,
        count: async ({ where }) => draft.versions.filter(
          (version) => version.sopDocumentId === where.sopDocumentId
        ).length,
        create: async ({ data }) => {
          const row = { id: `version-${++sequence}`, ...data };
          draft.versions.push(row);
          return row;
        }
      },
      submissionConversion: {
        findUnique: async ({ where }) => draft.conversions.find(
          (conversion) => conversion.requestId === where.requestId
        ) || null,
        create: async ({ data }) => {
          const row = { id: `conversion-${++sequence}`, ...data };
          draft.conversions.push(row);
          return row;
        }
      },
      auditLog: {
        create: async ({ data }) => {
          if (failAudit) throw new Error('audit write failed');
          draft.audit.push(data);
          return data;
        }
      }
    };
  }

  return {
    state,
    async $transaction(callback, options) {
      state.transactionOptions = options;
      const draft = structuredClone({
        submission,
        sourceVersion,
        documents: state.documents,
        versions: state.versions,
        conversions: state.conversions,
        audit: state.audit
      });
      const result = await callback(txFor(draft));
      if (raceConversion) {
        state.conversions.push(raceConversion);
        const race = new Error('unique request conversion race');
        race.code = 'P2002';
        race.meta = { target: ['requestId'] };
        throw race;
      }
      state.documents = draft.documents;
      state.versions = draft.versions;
      state.conversions = draft.conversions;
      state.audit = draft.audit;
      return result;
    },
    submissionConversion: {
      findUnique: async ({ where }) => state.conversions.find(
        (conversion) => conversion.requestId === where.requestId
      ) || null
    }
  };
}

function conversionInput(db) {
  return {
    requestId: 'submission-1',
    actor,
    expectedStatus: 'APPROVED',
    expectedUpdatedAt: timestamp.toISOString(),
    db
  };
}

test('new SOP conversion atomically creates a document, draft, conversion, and audit evidence', async () => {
  const db = makeDb({ submission: approvedSubmission() });
  const result = await convertApprovedSubmission(conversionInput(db));

  assert.equal(result.idempotent, false);
  assert.equal(result.mode, 'CREATE_SOP');
  assert.equal(db.state.documents.length, 1);
  assert.equal(db.state.documents[0].publishedVersionId, undefined);
  assert.equal(db.state.documents[0].status, 'DRAFT');
  assert.equal(db.state.versions.length, 1);
  assert.equal(db.state.versions[0].versionNo, '1.0');
  assert.equal(db.state.versions[0].lifecycleState, 'DRAFT');
  assert.equal(db.state.versions[0].approvalStatus, 'DRAFT');
  assert.equal(db.state.conversions.length, 1);
  assert.equal(db.state.audit.at(-1).action, 'SUBMISSION_CONVERTED');
  assert.equal(db.state.transactionOptions.isolationLevel, 'Serializable');
});

test('revision conversion uses only the official published version and leaves it unchanged', async () => {
  const published = {
    id: 'published-1',
    sopDocumentId: 'document-existing',
    versionNo: '2.0',
    lifecycleState: 'PUBLISHED',
    approvalStatus: 'APPROVED',
    approvedAt: new Date('2026-01-01T00:00:00.000Z'),
    approvedById: 'approver-1',
    fileKey: 'published.pdf',
    fileName: 'published.pdf',
    fileSize: 10,
    contentType: 'application/pdf',
    sopDocument: {
      id: 'document-existing',
      businessUnitId: 'bu-1',
      publishedVersionId: 'published-1'
    }
  };
  const submission = approvedSubmission({
    conversionIntent: 'CREATE_REVISION',
    requestedBusinessUnitId: 'bu-1',
    sopDocumentId: 'document-existing',
    sopDocument: {
      id: 'document-existing',
      businessUnitId: 'bu-1',
      publishedVersionId: 'published-1'
    }
  });
  const db = makeDb({ submission, sourceVersion: published });

  const result = await convertApprovedSubmission(conversionInput(db));
  const draft = db.state.versions.find((version) => version.id === result.sopVersionId);

  assert.equal(result.mode, 'CREATE_REVISION');
  assert.equal(result.idempotent, false);
  assert.equal(db.state.documents.length, 0);
  assert.equal(draft.lifecycleState, 'DRAFT');
  assert.equal(draft.approvalStatus, 'DRAFT');
  assert.equal(draft.approvedAt, undefined);
  assert.equal(draft.approvedById, undefined);
  assert.equal(published.sopDocument.publishedVersionId, 'published-1');
  assert.equal(db.state.conversions[0].sourceVersionId, 'published-1');
});

test('an existing conversion returns the same idempotent outcome without new writes', async () => {
  const existing = {
    id: 'conversion-existing',
    requestId: 'submission-1',
    mode: 'CREATE_SOP',
    sopDocumentId: 'document-existing',
    sopVersionId: 'version-existing'
  };
  const db = makeDb({ submission: approvedSubmission(), existingConversion: existing });

  const result = await convertApprovedSubmission(conversionInput(db));

  assert.deepEqual(result, {
    submissionId: 'submission-1',
    conversionId: 'conversion-existing',
    sopDocumentId: 'document-existing',
    sopVersionId: 'version-existing',
    mode: 'CREATE_SOP',
    idempotent: true
  });
  assert.equal(db.state.documents.length, 0);
  assert.equal(db.state.audit.length, 0);
});

test('a failed audit write rolls back all conversion records in the transaction', async () => {
  const db = makeDb({ submission: approvedSubmission(), failAudit: true });

  await assert.rejects(() => convertApprovedSubmission(conversionInput(db)), /audit write failed/);
  assert.equal(db.state.documents.length, 0);
  assert.equal(db.state.versions.length, 0);
  assert.equal(db.state.conversions.length, 0);
  assert.equal(db.state.audit.length, 0);
});

test('only governance actors can invoke conversion', async () => {
  const db = makeDb({ submission: approvedSubmission() });
  await assert.rejects(
    () => convertApprovedSubmission({ ...conversionInput(db), actor: { id: 'exec-1', role: 'EXECUTIVE' } }),
    { code: 'FORBIDDEN' }
  );
  await assert.rejects(
    () => convertApprovedSubmission({
      ...conversionInput(db),
      actor: { id: 'bu-1', role: 'BUSINESS_UNIT_PIC', businessUnitId: 'bu-1' }
    }),
    { code: 'FORBIDDEN' }
  );
});

test('Superuser and Tim Procurement retain approved cross-BU conversion authority', async () => {
  const db = makeDb({ submission: approvedSubmission({ requestedBusinessUnitId: 'another-bu' }) });
  const result = await convertApprovedSubmission({
    ...conversionInput(db),
    actor: { id: 'superuser-1', role: 'SUPER_USER' }
  });

  assert.equal(result.idempotent, false);
  assert.equal(db.state.documents[0].businessUnitId, 'another-bu');
});

test('stale or non-approved submissions cannot be converted', async () => {
  const staleDb = makeDb({ submission: approvedSubmission() });
  await assert.rejects(
    () => convertApprovedSubmission({
      ...conversionInput(staleDb),
      expectedUpdatedAt: '2026-07-30T00:00:01.000Z'
    }),
    { code: 'CONCURRENT_MODIFICATION' }
  );

  const submittedDb = makeDb({ submission: approvedSubmission({ status: 'SUBMITTED' }) });
  await assert.rejects(
    () => convertApprovedSubmission(conversionInput(submittedDb)),
    { code: 'INVALID_TRANSITION' }
  );
});

test('a concurrent request-id uniqueness race returns the sole conversion idempotently', async () => {
  const raceConversion = {
    id: 'conversion-race',
    requestId: 'submission-1',
    mode: 'CREATE_SOP',
    sopDocumentId: 'document-race',
    sopVersionId: 'version-race'
  };
  const db = makeDb({ submission: approvedSubmission(), raceConversion });
  const result = await convertApprovedSubmission(conversionInput(db));

  assert.equal(result.idempotent, true);
  assert.equal(result.conversionId, 'conversion-race');
  assert.equal(db.state.documents.length, 0);
  assert.equal(db.state.audit.length, 0);
});

test('a forged non-published revision source cannot produce a draft', async () => {
  const source = {
    id: 'forged-source',
    sopDocumentId: 'document-existing',
    versionNo: '3.0',
    lifecycleState: 'DRAFT',
    sopDocument: {
      id: 'document-existing',
      businessUnitId: 'bu-1',
      publishedVersionId: 'forged-source'
    }
  };
  const submission = approvedSubmission({
    conversionIntent: 'CREATE_REVISION',
    requestedBusinessUnitId: 'bu-1',
    sopDocumentId: 'document-existing',
    sopDocument: source.sopDocument
  });
  const db = makeDb({ submission, sourceVersion: source });

  await assert.rejects(() => convertApprovedSubmission(conversionInput(db)), {
    code: 'INVALID_TRANSITION'
  });
  assert.equal(db.state.conversions.length, 0);
});
