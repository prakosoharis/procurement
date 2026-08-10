import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { put } from '@vercel/blob/client';

const baseUrl = process.env.LOCAL_APP_URL || 'http://localhost:3000';
const databaseUrl = process.env.DATABASE_URL || 'postgresql://procurement:procurement@localhost:5432/procurement?schema=public';
const db = new PrismaClient({ datasourceUrl: databaseUrl });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function json(response, label) {
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${label} failed (${response.status}): ${body?.error || body?.message || 'unknown error'}`);
  return body;
}

async function request(pathname, options, cookie) {
  const headers = { ...(options?.headers || {}) };
  if (cookie) headers.cookie = cookie;
  return fetch(`${baseUrl}${pathname}`, { ...options, headers });
}

async function main() {
  const [actor, owner, businessUnit] = await Promise.all([
    db.user.findUnique({ where: { email: 'admin@procurement.local' } }),
    db.user.findUnique({ where: { email: 'budi@procurement.local' } }),
    db.businessUnit.findUnique({ where: { name: 'BKES' } })
  ]);
  assert(actor && owner && businessUnit, 'Data seed lokal untuk pengujian upload tidak ditemukan.');

  const documentType = await db.documentType.findFirst({
    where: {
      NOT: {
        documents: {
          some: { businessUnitId: businessUnit.id, status: { not: 'ARCHIVED' } }
        }
      }
    },
    orderBy: { code: 'asc' }
  });
  assert(documentType, 'Tidak ada jenis dokumen kosong untuk pengujian pada BU BKES.');

  const login = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: actor.email, password: 'demo12345' })
  });
  await json(login, 'Login lokal');
  const cookie = login.headers.get('set-cookie')?.split(';')[0];
  assert(cookie, 'Cookie sesi tidak diterima dari aplikasi lokal.');

  const file = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
  const title = `E2E Blob Drive ${randomUUID().slice(0, 8)}`;
  const prepared = await json(await request('/api/documents/direct-upload-sessions', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessUnitId: businessUnit.id,
      documentTypeId: documentType.id,
      title,
      language: 'id',
      ownerId: owner.id,
      reviewerId: actor.id,
      fileName: 'local-e2e-upload.pdf',
      contentType: 'application/pdf',
      fileSize: file.length
    })
  }, cookie), 'Membuat sesi upload');

  assert(prepared.uploadToken && prepared.transientBlobPath, 'Aplikasi tidak mengembalikan kredensial upload Blob.');
  const uploaded = await put(prepared.transientBlobPath, file, {
    access: 'private',
    token: prepared.uploadToken,
    contentType: 'application/pdf'
  });
  assert(uploaded.pathname === prepared.transientBlobPath, 'Blob diunggah ke lokasi yang tidak sesuai dengan sesi.');

  await json(await request(`/api/documents/direct-upload-sessions/${prepared.sessionId}/complete`, {
    method: 'POST'
  }, cookie), 'Menyelesaikan upload');

  let status;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    status = await json(await request(`/api/documents/direct-upload-sessions/${prepared.sessionId}`, { method: 'GET' }, cookie), 'Memeriksa status upload');
    if (status.status === 'COMPLETED' || status.status === 'FAILED') break;
  }

  assert(status?.status === 'COMPLETED', `Transfer tidak selesai: ${status?.message || status?.status || 'status tidak diketahui'}`);
  assert(status.id && status.versionId, 'Transfer selesai tetapi draft SOP tidak terbentuk.');
  console.log(JSON.stringify({ ok: true, sessionId: prepared.sessionId, sopDocumentId: status.id, sopVersionId: status.versionId, documentType: documentType.code }, null, 2));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
