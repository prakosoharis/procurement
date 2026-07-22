# Procurement Governance Hub

MVP local untuk SOP lifecycle governance: repository + upload file privat, SOP request, candidate refinement, validation queue, action tracker, audit log, dan reference center.

## Menjalankan dengan Docker

```bash
docker compose up --build
```

Buka:

- Aplikasi: http://localhost:3000
- MinIO Console: http://localhost:9001
- PostgreSQL: `localhost:5432`

Bucket `procurement-documents` dibuat otomatis dan bersifat privat. Kredensial lokal MinIO: `minioadmin` / `minioadmin`.

Login demo:

- Corporate Compliance Admin: `admin@procurement.local` / `demo12345`
- BU PIC: `budi@procurement.local` / `demo12345`

Untuk menghentikan layanan: `docker compose down`. Tambahkan `-v` hanya bila Anda sengaja ingin menghapus database dan file MinIO lokal.

## Menjalankan tanpa Docker

Siapkan PostgreSQL dan MinIO lokal, lalu salin `.env.example` menjadi `.env.local`. Ubah host `postgres` dan `minio` menjadi `localhost`, lalu jalankan:

```bash
npm install
npx prisma db push
npm run db:seed
npm run dev
```

## Staging / production

Tidak ada kode yang bergantung pada MinIO secara khusus. Ganti variabel `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, dan `S3_BUCKET` dengan kredensial S3/private S3-compatible storage. Tetap gunakan bucket privat dan URL download bertanda tangan (presigned URL).

## Batas MVP yang disengaja

- AI refinement saat ini membuat candidate finding terstruktur; provider LLM belum disambungkan.
- Tidak ada auto-scraping regulasi; reference masuk melalui upload atau URL resmi.
- Login lokal berbasis kredensial seed. Staging/production perlu diganti ke SSO perusahaan/OIDC.

## Data repository asli

Saat startup, database memuat master data berikut tanpa membuat dokumen contoh:

- 10 business unit (SMMA, SMM, dan Non Group) beserta industry-nya.
- 6 requirement `MANDATORY` (`M1`–`M6`).
- 7 requirement `ADDITIONAL` (`A1`–`A7`).

Unggah file melalui Repository. Sistem menyimpan file privat di MinIO, membuat record PostgreSQL dengan status `Draft v1.0`, dan menulis audit log. Revisi menghasilkan versi minor baru dalam status `Draft`; hanya Compliance Reviewer/Admin yang dapat mengubahnya menjadi `Approved`.

Endpoint yang dipakai frontend:

- `GET/POST /api/documents`
- `POST /api/documents/:id/versions`
- `POST /api/documents/:id/approve`
- `GET /api/repository-overview`
