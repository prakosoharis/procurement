import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { bestTemplatesPerType, canManageTemplates, matchesRequest, templateSpecificity } from "../lib/document-templates.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

// The template library is a starting point a Business Unit downloads, edits
// and gets approved OUTSIDE the application, then uploads as a Draft SOP
// through the existing flow. A null industry/size means "applies to all", so
// one generic template need not be duplicated per combination.

const M1 = { id: "m1", code: "M1", name: "Procurement Policy", sortOrder: 1 };
const M2 = { id: "m2", code: "M2", name: "Procurement SOP", sortOrder: 2 };
const mining = { id: "ind-mining", name: "Mining" };
const finance = { id: "ind-fin", name: "Financial Services" };
const besar = { id: "sz-besar", name: "Besar" };
const kecil = { id: "sz-kecil", name: "Kecil" };

const generic = { id: "t-generic", title: "Umum", documentType: M1, industry: null, companySize: null };
const miningBesar = { id: "t-mb", title: "Mining Besar", documentType: M1, industry: mining, companySize: besar };
const miningAnySize = { id: "t-m", title: "Mining", documentType: M1, industry: mining, companySize: null };

test("only Superuser or Tim Procurement may manage templates; everyone else may still browse and download", () => {
  assert.equal(canManageTemplates({ role: "SUPER_USER" }), true);
  assert.equal(canManageTemplates({ role: "CORPORATE_GOVERNANCE" }), true);
  assert.equal(canManageTemplates({ role: "BUSINESS_UNIT_PIC" }), false);
  assert.equal(canManageTemplates(null), false);
});

test("a template bound to one industry does not match a request for a different industry", () => {
  assert.equal(matchesRequest(miningBesar, { industryId: "ind-fin", companySizeId: "sz-besar" }), false);
  assert.equal(matchesRequest(miningBesar, { industryId: "ind-mining", companySizeId: "sz-kecil" }), false);
  assert.equal(matchesRequest(miningBesar, { industryId: "ind-mining", companySizeId: "sz-besar" }), true);
});

test("an 'applies to all' template matches any request, including one with no criteria at all", () => {
  assert.equal(matchesRequest(generic, { industryId: "ind-mining", companySizeId: "sz-besar" }), true);
  assert.equal(matchesRequest(generic, { industryId: null, companySizeId: null }), true);
});

test("a template bound to a specific industry is NOT offered when the user picked no industry -- it would be wrong to hand a Mining template to someone who never said Mining", () => {
  assert.equal(matchesRequest(miningBesar, { industryId: null, companySizeId: null }), false);
  assert.equal(matchesRequest(miningAnySize, { industryId: null, companySizeId: null }), false);
});

test("the most specific matching template wins, so a generic one never shadows a targeted one", () => {
  assert.ok(templateSpecificity(miningBesar) > templateSpecificity(miningAnySize));
  assert.ok(templateSpecificity(miningAnySize) > templateSpecificity(generic));

  const all = [generic, miningAnySize, miningBesar];
  const exact = bestTemplatesPerType(all, { industryId: mining.id, companySizeId: besar.id });
  assert.deepEqual(exact.map((t) => t.title), ["Mining Besar"]);

  // Mining but a different size falls back to the industry-wide template.
  const bySize = bestTemplatesPerType(all, { industryId: mining.id, companySizeId: kecil.id });
  assert.deepEqual(bySize.map((t) => t.title), ["Mining"]);

  // A different industry falls all the way back to the generic template.
  const other = bestTemplatesPerType(all, { industryId: finance.id, companySizeId: besar.id });
  assert.deepEqual(other.map((t) => t.title), ["Umum"]);
});

test("exactly one template is offered per document type, ordered by the document type's own order", () => {
  const m2 = { id: "t-m2", title: "SOP Umum", documentType: M2, industry: null, companySize: null };
  const results = bestTemplatesPerType([m2, generic], { industryId: null, companySizeId: null });
  assert.deepEqual(results.map((t) => t.documentType.code), ["M1", "M2"]);
});

test("the uniqueness index treats 'applies to all' as a real value, since SQL would otherwise accept unlimited duplicate NULL rows", async () => {
  const migration = await read("../prisma/migrations/20260826040000_add_document_templates/migration.sql");
  assert.match(migration, /CREATE UNIQUE INDEX "DocumentTemplate_scope_key"/);
  assert.match(migration, /COALESCE\("industryId", '__all__'\)/);
  assert.match(migration, /COALESCE\("companySizeId", '__all__'\)/);
});

test("company size is optional on a Business Unit, so the units that predate the field keep working", async () => {
  const migration = await read("../prisma/migrations/20260826040000_add_document_templates/migration.sql");
  assert.match(migration, /ALTER TABLE "BusinessUnit" ADD COLUMN "companySizeId" TEXT;/);
  assert.doesNotMatch(migration, /"companySizeId" TEXT NOT NULL/);
  const masterData = await read("../app/api/master-data/route.js");
  assert.match(masterData, /companySizeId \? tx\.companySize\.findUnique/);
  assert.match(masterData, /companySizeId: companySize\?\.id \?\? null/);
});

test("uploading or deleting a template is manager-gated, and an empty industry/size from the form is stored as null rather than an empty string", async () => {
  const route = await read("../app/api/document-templates/route.js");
  assert.match(route, /if \(!canManageTemplates\(user\)\) return NextResponse\.json\(\{ error: 'Hanya Super User atau Tim Procurement yang dapat mengelola template\.' \}, \{ status: 403 \}\)/);
  assert.match(route, /const industryId = data\.get\('industryId'\)\?\.toString\(\) \|\| null;/);
  // A duplicate combination is reported as a conflict, not a 500.
  assert.match(route, /if \(error\?\.code === 'P2002'\)/);

  const detail = await read("../app/api/document-templates/[id]/route.js");
  assert.match(detail, /if \(!canManageTemplates\(user\)\)/);
});

test("templates are stored outside the SOP tree so nobody browsing Drive mistakes a blank template for an issued policy", async () => {
  const folders = await read("../lib/google-drive-folders.js");
  assert.match(folders, /segments: \["Template SOP", documentTypeCode\]/);
});

test("templates are not indexed for chatbot search, so the assistant can never quote a blank example as a governing policy", async () => {
  const indexService = await read("../lib/sop-content/index-service.js");
  assert.doesNotMatch(indexService, /documentTemplate/i);
  const contentRetriever = await read("../lib/ai/chat/retrievers/sop-content.js");
  assert.doesNotMatch(contentRetriever, /DocumentTemplate/);
  const repositoryRetriever = await read("../lib/ai/chat/retrievers/repository.js");
  assert.doesNotMatch(repositoryRetriever, /documentTemplate/i);
});
