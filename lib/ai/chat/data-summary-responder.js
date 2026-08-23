// Answers from retrieved application records without calling a model.
//
// This is not AI and must never be presented as AI: responses carry
// mode DATA_SUMMARY so the interface labels them. It covers factual list and
// count questions, which is most of what a governance assistant is asked, and
// says so plainly when a question needs reasoning it cannot do.

const MAX_ITEMS = 12;

function normalize(question) {
  return String(question || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function has(text, ...keywords) {
  return keywords.some((keyword) => text.includes(keyword));
}

function list(items) {
  const shown = items.slice(0, MAX_ITEMS).map((item) => `• ${item}`);
  if (items.length > MAX_ITEMS) shown.push(`… dan ${items.length - MAX_ITEMS} lainnya.`);
  return shown.join('\n');
}

function section(heading, items) {
  return items.length ? `${heading}\n\n${list(items)}` : null;
}

const byType = (records, type) => records.filter((record) => record.type === type);

function repositoryAnswer(text, records) {
  const coverage = byType(records, 'REPOSITORY_COVERAGE');
  const documents = byType(records, 'SOP_DOCUMENT');

  if (has(text, 'lengkap', 'kurang', 'missing', 'belum', 'coverage', 'cakupan', 'kepatuhan', 'compliance')) {
    const incomplete = coverage.filter((unit) => unit.missingMandatoryTypes?.length);
    const complete = coverage.filter((unit) => !unit.missingMandatoryTypes?.length);
    if (!coverage.length) return null;
    if (!incomplete.length) return `Seluruh ${coverage.length} Business Unit sudah melengkapi dokumen wajib.`;
    const heading = `${incomplete.length} dari ${coverage.length} Business Unit belum melengkapi dokumen wajib.`;
    const gaps = section(heading, incomplete.map((unit) => `${unit.label} — kurang ${unit.missingMandatoryTypes.length}: ${unit.missingMandatoryTypes.join(', ')}`));
    return complete.length ? `${gaps}\n\nSudah lengkap: ${complete.map((unit) => unit.label).join(', ')}.` : gaps;
  }

  if (has(text, 'menunggu', 'review', 'draft', 'belum disetujui', 'pending')) {
    const drafts = documents.filter((document) => document.status === 'DRAFT' || document.latestVersionStatus === 'DRAFT');
    if (!drafts.length) return documents.length ? 'Tidak ada dokumen berstatus draft yang menunggu review.' : null;
    return section(
      `${drafts.length} dokumen menunggu review.`,
      drafts.map((document) => `${document.label} (${document.businessUnit || '-'}) ${document.currentVersion || ''} — reviewer: ${document.assignedReviewer || 'belum ditugaskan'}`)
    );
  }

  if (!documents.length) return null;
  const approved = documents.filter((document) => ['APPROVED', 'PUBLISHED'].includes(document.status));
  return section(
    `${documents.length} dokumen SOP dalam cakupan Anda, ${approved.length} sudah disetujui.`,
    documents.map((document) => `${document.label} (${document.businessUnit || '-'}) — ${document.status}${document.documentType ? `, ${document.documentType}` : ''}`)
  );
}

function submissionsAnswer(text, records) {
  const submissions = byType(records, 'SUBMISSION');
  if (!submissions.length) return null;
  const open = submissions.filter((item) => !['APPROVED', 'REJECTED'].includes(item.status));
  const filtered = has(text, 'terbuka', 'open', 'menunggu', 'pending', 'belum') ? open : submissions;
  if (!filtered.length) return 'Tidak ada submission yang masih terbuka.';
  return section(
    `${filtered.length} submission${filtered === open ? ' masih terbuka' : ''} (total ${submissions.length}, ${open.length} terbuka).`,
    filtered.map((item) => `${item.label} (${item.businessUnit || '-'}) — ${item.status}, prioritas ${item.priority}`)
  );
}

function refinementAnswer(text, records) {
  const findings = byType(records, 'REFINEMENT_FINDING');
  const sessions = byType(records, 'REFINEMENT_SESSION');

  if (has(text, 'temuan', 'finding', 'severity', 'risiko', 'gap') && findings.length) {
    const open = findings.filter((finding) => finding.status === 'OPEN');
    const critical = open.filter((finding) => ['CRITICAL', 'HIGH'].includes(finding.severity));
    return section(
      `${findings.length} temuan tercatat, ${open.length} masih terbuka${critical.length ? `, ${critical.length} di antaranya HIGH atau CRITICAL` : ''}.`,
      (critical.length ? critical : open).map((finding) => `[${finding.severity}] ${finding.label} — ${finding.relatedSop || '-'} (${finding.businessUnit || '-'})`)
    );
  }

  if (!sessions.length) return null;
  return section(
    `${sessions.length} sesi refinement dalam cakupan Anda.`,
    sessions.map((session) => `${session.label} — ${session.status}, ${session.openFindings} temuan terbuka`)
  );
}

function auditAnswer(text, records) {
  const events = byType(records, 'AUDIT_EVENT');
  if (!events.length) return null;
  const now = Date.now();
  const upcoming = events.filter((event) => new Date(event.startAt).getTime() >= now && event.status !== 'CANCELLED');
  const selected = has(text, 'lalu', 'sebelumnya', 'selesai', 'riwayat', 'past') ? events : upcoming;
  if (!selected.length) return 'Tidak ada jadwal audit mendatang.';
  return section(
    `${selected.length} jadwal audit${selected === upcoming ? ' mendatang' : ''}.`,
    selected.map((event) => `${event.label} — ${new Date(event.startAt).toISOString().slice(0, 10)}, ${event.format}${event.businessUnit ? `, ${event.businessUnit}` : ''} (${event.confirmedCount}/${event.participantCount} konfirmasi)`)
  );
}

function peopleAnswer(text, records) {
  const positions = byType(records, 'ORGANIZATION_POSITION');
  if (!positions.length) return null;

  if (has(text, 'lowong', 'vacant', 'kosong')) {
    const vacant = positions.filter((position) => position.vacant);
    if (!vacant.length) return 'Tidak ada posisi yang lowong dalam cakupan Anda.';
    return section(`${vacant.length} posisi lowong.`, vacant.map((position) => `${position.label}${position.scope ? ` (${position.scope})` : ''}`));
  }

  const occupied = positions.filter((position) => !position.vacant);
  return section(
    `${positions.length} posisi dalam cakupan Anda, ${occupied.length} terisi.`,
    positions.map((position) => `${position.label}${position.scope ? ` (${position.scope})` : ''} — ${position.vacant ? 'lowong' : position.occupants.map((occupant) => occupant.name).join(', ')}`)
  );
}

const renderers = Object.freeze({
  repository: repositoryAnswer,
  engagement: repositoryAnswer,
  submissions: submissionsAnswer,
  refinement: refinementAnswer,
  audit: auditAnswer,
  people: peopleAnswer
});

export const DATA_SUMMARY_NOTE =
  'Ringkasan ini disusun langsung dari data Hub, bukan hasil analisis AI.';

export function answerFromData({ question, results = [] }) {
  const text = normalize(question);
  const parts = [];
  const references = [];

  for (const result of results) {
    const render = renderers[result.topic];
    if (!render) continue;
    const rendered = render(text, result.records || []);
    if (rendered) parts.push(rendered);
    for (const record of result.records || []) {
      if (record.label) references.push({ label: record.label, recordType: record.type, recordId: record.id });
    }
  }

  if (!parts.length) {
    return {
      answer: `Tidak ada data yang cocok dengan pertanyaan itu di Procurement Governance Hub.\n\n${DATA_SUMMARY_NOTE} Pertanyaan yang membutuhkan penalaran atau perbandingan belum dapat dijawab pada mode ini.`,
      dataAvailable: false,
      references: [],
      mode: 'DATA_SUMMARY'
    };
  }

  return {
    answer: `${parts.join('\n\n')}\n\n${DATA_SUMMARY_NOTE}`,
    dataAvailable: true,
    references: references.slice(0, 8),
    mode: 'DATA_SUMMARY'
  };
}
