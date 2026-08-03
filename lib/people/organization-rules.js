import { fail } from '../governance/errors.js';

export function parseExpectedUpdatedAt(value) {
  if (typeof value !== 'string' || !value.trim()) fail('INVALID_INPUT', 'expectedUpdatedAt is required.');
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) fail('INVALID_INPUT', 'expectedUpdatedAt must be a valid ISO date.');
  return parsed;
}

export function normalizedText(value, label, { required = false, maxLength = 500 } = {}) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) fail('INVALID_INPUT', `${label} is required.`);
  if (text.length > maxLength) fail('INVALID_INPUT', `${label} is too long.`);
  return text || null;
}

export function parseOrder(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) fail('INVALID_INPUT', 'displayOrder must be a non-negative integer.');
  return parsed;
}

export function boundedOrder(order, itemCount) {
  return Math.max(0, Math.min(order ?? itemCount, itemCount));
}

export function hierarchyHasCycle(positionId, proposedParentId, parentById) {
  let cursor = proposedParentId;
  const visited = new Set();
  while (cursor) {
    if (cursor === positionId || visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentById.get(cursor) || null;
  }
  return false;
}

export function activeAssignmentWhere(asOf = new Date()) {
  return { OR: [{ endDate: null }, { endDate: { gt: asOf } }] };
}
