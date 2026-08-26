import { effectiveBusinessUnitIds, isBusinessUnitScoped } from './authorization/scope.js';

// Visibility for SOP documents once they can be issued at Group level.
//
// Mirrors peoplePositionScopeWhere in lib/people/scope.js, which already
// established this rule for the People menu: a Business Unit user sees what
// belongs to their own Business Unit, plus what belongs to a Group that
// contains their Business Unit. Anyone not Business-Unit-scoped sees
// everything, exactly as before.
export function sopDocumentScopeWhere(user) {
  if (!isBusinessUnitScoped(user)) return {};
  const ids = effectiveBusinessUnitIds(user);
  if (!ids.length) return { id: '__no-sop-access__' };
  return {
    OR: [
      { businessUnitId: { in: ids } },
      { organizationGroup: { businessUnits: { some: { id: { in: ids } } } } }
    ]
  };
}

// The compliance matrix, mandatory-gap counts, and Engagement scoring are
// strictly per-Business-Unit: a Group document does not close a Business
// Unit's requirement. Anything computing coverage must therefore filter with
// this, not with sopDocumentScopeWhere.
export function businessUnitScopedDocumentsOnly() {
  return { scopeType: 'BUSINESS_UNIT' };
}

// Owner label for a document under either scope, so list views and the
// chatbot can name the issuer without branching everywhere.
export function documentOwnerName(document) {
  return document?.businessUnit?.name || document?.organizationGroup?.name || null;
}
