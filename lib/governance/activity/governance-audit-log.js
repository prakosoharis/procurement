export async function recordGovernanceEvent(tx, { actor, businessUnitId, entity, entityId, action, previousState = null, resultingState = null, reason = null, metadata = {} }) {
  // AuditLog is deliberately compact; structured, non-secret context is JSON in detail.
  return tx.auditLog.create({ data: { actorId: actor.id, entity, entityId, action, detail: JSON.stringify({ actorRole: actor.role, businessUnitId, previousState, resultingState, reason, metadata, timestamp: new Date().toISOString() }) } });
}
