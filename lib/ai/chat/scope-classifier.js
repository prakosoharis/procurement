// Deterministic in/out-of-scope gate. This runs BEFORE any provider call, so an
// out-of-scope question costs nothing and can never reach the model. Keeping it
// rule-based also means the boundary is testable and cannot be talked around by
// the question itself.

const topicKeywords = Object.freeze({
  repository: [
    'sop', 'dokumen', 'document', 'repository', 'repositori', 'kepatuhan', 'compliance',
    'mandatory', 'wajib', 'draft', 'approve', 'approval', 'persetujuan', 'versi', 'version',
    'unggah', 'upload', 'kebijakan', 'policy', 'prosedur', 'lengkap', 'coverage', 'cakupan',
    'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'reviewer', 'penerbitan', 'publish'
  ],
  submissions: [
    'submission', 'pengajuan', 'permintaan', 'request', 'usulan', 'tiket', 'ticket',
    'perubahan', 'revisi', 'revision', 'diajukan'
  ],
  refinement: [
    'refinement', 'temuan', 'finding', 'findings', 'klarifikasi', 'clarification',
    'gap', 'validasi', 'validation', 'sumber', 'pembanding', 'regulasi', 'regulation',
    'analisis', 'analysis', 'severity', 'risiko', 'risk'
  ],
  audit: [
    'audit', 'jadwal', 'schedule', 'kalender', 'calendar', 'appointment', 'agenda',
    'rapat', 'meeting', 'kunjungan', 'onsite', 'peserta', 'kehadiran', 'attendance'
  ],
  people: [
    'struktur', 'organisasi', 'organization', 'jabatan', 'posisi', 'position',
    'personel', 'pegawai', 'karyawan', 'staff', 'menjabat', 'occupant', 'vacant',
    'lowong', 'sertifikasi', 'certification', 'pendidikan', 'education',
    'masa kerja', 'atasan', 'bawahan', 'pic', 'direktori', 'directory', 'pejabat'
  ],
  engagement: [
    'engagement', 'keterlibatan', 'indikator', 'indicator', 'skor', 'score', 'indeks', 'index'
  ],
  'sop-content': [
    'isi', 'berbunyi', 'menyebutkan', 'tertulis', 'pasal', 'ayat', 'bab', 'klausul',
    'butir', 'ketentuan', 'aturan', 'mengatur'
  ]
});

// Organisational vocabulary. A question naming one of these is about this
// application even when it uses none of the topic words above.
// Deliberately excludes bare ambiguous tokens such as "bu" and "siapa": a
// generic question must not become in-scope on one common word alone.
const domainKeywords = [
  'business unit', 'bisnis unit', 'organization group', 'procurement', 'pengadaan',
  'governance', 'tata kelola', 'procurement governance hub'
];

const DEFAULT_TOPICS = Object.freeze(['repository', 'submissions', 'refinement']);

function normalize(question) {
  return String(question || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function classifyChatScope(question) {
  const normalized = normalize(question);
  if (!normalized) return { inScope: false, topics: [], reason: 'EMPTY_QUESTION' };

  const words = new Set(normalized.split(' '));
  const topics = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some((keyword) => (keyword.includes(' ') ? normalized.includes(keyword) : words.has(keyword)))) {
      topics.push(topic);
    }
  }

  if (topics.length) return { inScope: true, topics, reason: null };

  // No topic matched, but the question still names the organisation domain.
  // Fall back to the governance topics rather than refusing a valid question.
  const mentionsDomain = domainKeywords.some((keyword) => (keyword.includes(' ') ? normalized.includes(keyword) : words.has(keyword)));
  if (mentionsDomain) return { inScope: true, topics: [...DEFAULT_TOPICS], reason: null };

  return { inScope: false, topics: [], reason: 'OUT_OF_SCOPE' };
}

export const OUT_OF_SCOPE_ANSWER =
  'Asisten ini hanya melayani informasi yang ada di Procurement Governance Hub, seperti SOP dan kepatuhan dokumen (termasuk isi pasal/ketentuan di dalamnya), submission, refinement, jadwal audit, engagement, serta struktur organisasi dan personel.';
