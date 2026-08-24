// JSON Schemas shared by every provider. Both providers must return these exact
// shapes, which is what makes AI_PROVIDER a configuration switch instead of a
// rewrite. Field names mirror the existing Prisma models so a candidate finding
// can be persisted without a translation table.

// Mirrors Prisma enum RiskLevel.
export const RISK_LEVELS = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

// Mirrors Prisma enum HumanRefinementFindingCategory so an AI candidate finding
// can later be consolidated into a human finding without losing its category.
export const FINDING_CATEGORIES = Object.freeze([
  'REGULATORY_MISMATCH',
  'INTERNAL_POLICY_CONFLICT',
  'PROCESS_GAP',
  'CONTROL_WEAKNESS',
  'AMBIGUOUS_WORDING',
  'DUPLICATE_OR_INCONSISTENT_RULE',
  'ROLE_AND_RESPONSIBILITY_ISSUE',
  'AUDIT_OR_FRAUD_RISK',
  'DOCUMENT_QUALITY',
  'OTHER'
]);

export const CHAT_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['answer', 'dataAvailable', 'references'],
  properties: {
    answer: {
      type: 'string',
      description: 'Jawaban ringkas dalam Bahasa Indonesia, hanya berdasarkan konteks aplikasi yang diberikan.'
    },
    dataAvailable: {
      type: 'boolean',
      description: 'false jika konteks yang diberikan tidak memuat informasi yang cukup untuk menjawab.'
    },
    references: {
      type: 'array',
      description: 'Catatan aplikasi yang mendasari jawaban. Kosong jika dataAvailable bernilai false.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'recordType'],
        properties: {
          label: { type: 'string', description: 'Nama yang dapat dibaca pengguna, misalnya judul SOP atau nama Business Unit.' },
          recordType: { type: 'string', description: 'Jenis catatan, misalnya SOP_DOCUMENT, BUSINESS_UNIT, atau AUDIT_EVENT.' },
          recordId: { type: 'string', description: 'Identifier catatan bila tersedia di konteks.' }
        }
      }
    }
  }
});

export const REFINEMENT_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'findings'],
  properties: {
    summary: {
      type: 'string',
      description: 'Ringkasan analisis perbandingan SOP terhadap sumber pembanding.'
    },
    findings: {
      type: 'array',
      description: 'Temuan kandidat. Kosongkan bila tidak ada gap yang didukung bukti.',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'category', 'severity', 'gap', 'recommendation', 'confidence', 'evidence'],
        properties: {
          title: { type: 'string' },
          category: { type: 'string', enum: [...FINDING_CATEGORIES] },
          severity: { type: 'string', enum: [...RISK_LEVELS] },
          currentState: { type: 'string', description: 'Isi SOP saat ini yang relevan. Kosongkan bila tidak ada.' },
          gap: { type: 'string', description: 'Selisih antara SOP dan sumber pembanding.' },
          recommendation: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence: {
            type: 'object',
            additionalProperties: false,
            required: ['sopSection', 'sourceSection', 'sourceQuote', 'justification', 'impact'],
            properties: {
              sopSection: { type: 'string', description: 'Lokasi di SOP, misalnya nomor bab/pasal/klausul dari konteks.' },
              sourceSection: { type: 'string', description: 'Lokasi di sumber pembanding, misalnya pasal atau halaman.' },
              sopQuote: { type: 'string', description: 'Kutipan persis dari SOP bila tersedia di konteks.' },
              sourceQuote: { type: 'string', description: 'Kutipan persis dari sumber pembanding.' },
              justification: { type: 'string', description: 'Alasan kedua bagian tersebut berhubungan.' },
              impact: { type: 'string', description: 'Dampak bila gap ini tidak ditangani.' },
              proposedText: { type: 'string', description: 'Usulan redaksi SOP. Hanya usulan; tidak pernah diterapkan otomatis.' }
            }
          }
        }
      }
    }
  }
});
