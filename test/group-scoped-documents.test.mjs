import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { sopDocumentScopeWhere } from "../lib/sop-scope.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// A SOP document is issued either by one Business Unit or by an Organization
// Group covering several. The agreed rules, which these tests pin down:
//   1. Both levels may hold a document for the same type -- not everything is
//      centralised at Group level.
//   2. A Business Unit's own document takes precedence for that Business Unit.
//   3. A Group document does NOT close a Business Unit's mandatory
//      requirement: compliance stays strictly per Business Unit.

test("the database itself refuses a document owned by nobody or by both a Business Unit and a Group at once", async () => {
  const migration = await read("../prisma/migrations/20260826020000_add_group_scoped_sop_documents/migration.sql");
  assert.match(migration, /ADD CONSTRAINT "SopDocument_scope_owner_check" CHECK/);
  assert.match(migration, /"scopeType" = 'BUSINESS_UNIT' AND "businessUnitId" IS NOT NULL AND "organizationGroupId" IS NULL/);
  assert.match(migration, /"scopeType" = 'GROUP' AND "organizationGroupId" IS NOT NULL AND "businessUnitId" IS NULL/);
  // Existing rows keep their Business Unit and meaning.
  assert.match(migration, /DEFAULT 'BUSINESS_UNIT'/);
});

test("a Business Unit viewer sees their own documents plus those issued by a Group containing their Business Unit", () => {
  const pic = { role: "BUSINESS_UNIT_PIC", businessUnitId: "bu-1", businessUnitScopes: [] };
  const where = sopDocumentScopeWhere(pic);
  assert.deepEqual(where.OR[0], { businessUnitId: { in: ["bu-1"] } });
  assert.deepEqual(where.OR[1], { organizationGroup: { businessUnits: { some: { id: { in: ["bu-1"] } } } } });
});

test("a viewer with no effective Business Unit fails closed rather than seeing every Group document", () => {
  const where = sopDocumentScopeWhere({ role: "BUSINESS_UNIT_PIC", businessUnitId: null, businessUnitScopes: [] });
  assert.deepEqual(where, { id: "__no-sop-access__" });
});

test("a cross-Business-Unit role is not narrowed at all", () => {
  assert.deepEqual(sopDocumentScopeWhere({ role: "SUPER_USER", businessUnitId: null, businessUnitScopes: [] }), {});
});

test("only Superuser or Tim Procurement may issue a Group document, since it governs sibling Business Units", async () => {
  const source = await read("../lib/document-direct-upload-service.js");
  assert.match(source, /function groupPublisherOrThrow\(actor\)/);
  assert.match(source, /Hanya Super User atau Tim Procurement yang dapat menerbitkan dokumen level Group/);
  assert.match(source, /if \(isGroup\) groupPublisherOrThrow\(actor\); else managerOrThrow\(actor, businessUnitId\);/);
  // The same authority is required for later steps of an existing session,
  // not only at creation.
  assert.match(source, /function sessionManagerOrThrow\(actor, session\)/);
});

test("a Group document's PIC must belong to a Business Unit inside that Group", async () => {
  const source = await read("../lib/document-direct-upload-service.js");
  assert.match(source, /\{ id: ownerId, role: 'BUSINESS_UNIT_PIC', businessUnit: \{ organizationGroupId \} \}/);
});

test("the compliance matrix ignores Group documents, so a Group policy never marks its Business Units compliant", async () => {
  const retriever = await read("../lib/ai/chat/retrievers/repository.js");
  assert.match(retriever, /if \(document\.scopeType === 'GROUP'\) continue;/);
  const ui = await read("../app/hub/repository/sop-tab.js");
  assert.match(ui, /if \(d\.scopeType === 'GROUP'\) return;/);
});

test("chat retrieval reports a Group as the issuer rather than presenting it as a Business Unit", async () => {
  const repository = await read("../lib/ai/chat/retrievers/repository.js");
  assert.match(repository, /issuerLevel: document\.scopeType === 'GROUP' \? 'GROUP' : 'BUSINESS_UNIT'/);
  const content = await read("../lib/ai/chat/retrievers/sop-content.js");
  assert.match(content, /issuerLevel: row\.scopeType === 'GROUP' \? 'GROUP' : 'BUSINESS_UNIT'/);
});

test("SOP content search left-joins the owner tables, since an inner join on BusinessUnit would drop every Group document", async () => {
  const source = await read("../lib/ai/chat/retrievers/sop-content.js");
  assert.match(source, /LEFT JOIN "BusinessUnit" bu ON bu\.id = d\."businessUnitId"/);
  assert.match(source, /LEFT JOIN "OrganizationGroup" og ON og\.id = d\."organizationGroupId"/);
  assert.match(source, /COALESCE\(bu\.name, og\.name\) AS "ownerName"/);
});

test("Refinement and Request refuse a Group document with a stated reason instead of failing on a null Business Unit", async () => {
  const lifecycle = await read("../lib/governance/lifecycle/sop-version-lifecycle.js");
  assert.match(lifecycle, /if \(version\.sopDocument\.scopeType === 'GROUP'\) fail\('FORBIDDEN', 'Dokumen level Group belum didukung pada alur Refinement dan publikasi\.'\)/);
  // Refused BEFORE assertScope, which would otherwise receive a null id.
  const refusalAt = lifecycle.indexOf("scopeType === 'GROUP'");
  const assertAt = lifecycle.indexOf("assertScope(actor, version.sopDocument.businessUnitId)");
  assert.ok(refusalAt > -1 && refusalAt < assertAt);

  const requests = await read("../app/api/requests/route.js");
  assert.match(requests, /Dokumen level Group belum didukung pada alur Request perubahan\./);
});

test("Group documents are stored under their own Drive path, so a Group and a Business Unit sharing a name cannot collide", async () => {
  const source = await read("../lib/google-drive-folders.js");
  assert.match(source, /segments: \["SOP", "Group", organizationGroup\.name\]/);
});

test("the upload session carries the scope through to document creation, and its uniqueness lock covers both scopes", async () => {
  const service = await read("../lib/document-direct-upload-service.js");
  assert.match(service, /purpose: 'CREATE_DOCUMENT', scopeType, businessUnitId, organizationGroupId/);
  assert.match(service, /data: \{ scopeType: current\.scopeType, \.\.\.scopeKey/);

  const migration = await read("../prisma/migrations/20260826030000_group_scope_upload_sessions/migration.sql");
  assert.match(migration, /GoogleDriveUploadSession_one_active_bu_document_key/);
  assert.match(migration, /GoogleDriveUploadSession_one_active_group_document_key/);
});
