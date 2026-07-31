export function findingDto(finding) {
  return {
    id: finding.id,
    title: finding.title,
    category: finding.category,
    categoryExplanation: finding.categoryExplanation,
    severity: finding.severity,
    observation: finding.observation,
    documentLocation: finding.documentLocation,
    blocking: finding.blocking,
    blockingOverrideReason: finding.blockingOverrideReason,
    riskImpact: finding.riskImpact,
    recommendation: finding.recommendation,
    owner: finding.owner || null,
    followUp: {
      required: finding.followUpRequired,
      suggestedOwner: finding.followUpSuggestedOwner,
      targetAt: finding.followUpTargetAt,
      note: finding.followUpNote
    },
    status: finding.status,
    disposition: {
      resolutionType: finding.resolutionType,
      resolutionSummary: finding.resolutionSummary,
      resolvedBy: finding.resolvedBy || null,
      resolvedAt: finding.resolvedAt,
      deferReason: finding.deferReason,
      deferOwner: finding.deferOwner,
      deferTargetAt: finding.deferTargetAt,
      riskAcknowledgement: finding.riskAcknowledgement,
      dismissalReason: finding.dismissalReason
    },
    createdBy: finding.createdBy,
    createdAt: finding.createdAt,
    updatedAt: finding.updatedAt,
    evidence: (finding.evidence || []).map(evidenceDto),
    clarifications: (finding.clarifications || []).map(clarificationDto)
  };
}

export function evidenceDto(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    excerpt: item.excerpt,
    source: item.source,
    documentLocation: item.documentLocation,
    hasAttachment: Boolean(item.attachmentKey),
    addedBy: item.addedBy,
    createdAt: item.createdAt
  };
}

export function clarificationDto(item) {
  return {
    id: item.id,
    question: item.question,
    response: item.response,
    responseEvidence: item.responseEvidence,
    status: item.status,
    dueAt: item.dueAt,
    respondedAt: item.respondedAt,
    closedAt: item.closedAt,
    updatedAt: item.updatedAt,
    requestedBy: item.requestedBy,
    requestedBusinessUnit: item.requestedBusinessUnit,
    respondedBy: item.respondedBy || null,
    closedBy: item.closedBy || null
  };
}

export function historyDto(item) {
  let detail = null;
  try {
    detail = item.detail ? JSON.parse(item.detail) : null;
  } catch {
    detail = item.detail ? { reason: item.detail } : null;
  }
  return {
    id: item.id,
    entity: item.entity,
    entityId: item.entityId,
    action: item.action,
    detail,
    actor: item.actor || null,
    createdAt: item.createdAt
  };
}
