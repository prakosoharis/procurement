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

## Deploy production: Vercel + Neon

Panduan ini memakai **Vercel untuk aplikasi** dan **Neon untuk PostgreSQL**. Docker, PostgreSQL, dan MinIO di `docker-compose.yml` hanya untuk development lokal; Vercel tidak menjalankan Docker Compose.

### 0. Prasyarat dan keputusan penting

1. Pastikan branch `main` sudah dipush ke repository GitHub.
2. Siapkan akun Vercel dan Neon. Paket gratis cocok untuk demo/internal dengan trafik kecil; periksa batas layanan sebelum dipakai untuk kebutuhan perusahaan.
3. Aplikasi ini masih menggunakan API S3-compatible untuk file SOP. **MinIO lokal tidak bisa diakses oleh Vercel.** Database dan aplikasi dapat dideploy sekarang, tetapi upload/preview/download dokumen baru siap production setelah storage production dikonfigurasi. Migrasi ke Google Drive yang sedang ditunda dapat dikerjakan terpisah tanpa mengubah URL Vercel.

### 1. Buat database Neon

1. Masuk ke [Neon Console](https://console.neon.tech), lalu pilih **New project**.
2. Pilih region yang paling dekat dengan pengguna (mis. Singapore), PostgreSQL versi default, lalu beri nama `procurement-production`.
3. Setelah project jadi, buka **Connect** dan salin **pooled connection string** (biasanya hostname memuat `-pooler`). Jangan bagikan atau commit URL ini.
4. Simpan URL tersebut pada password manager. URL harus tetap memuat `sslmode=require` jika Neon memberikannya.

### 2. Terapkan schema ke Neon (sekali untuk database baru)

Repository sudah memiliki baseline migration di `prisma/migrations`. Jalankan dari terminal lokal, dengan URL Neon disimpan sementara pada environment shell Anda:

```bash
export DATABASE_URL='postgresql://...connection-string-neon...'
npm ci
npm run db:migrate:deploy
```

Verifikasi hasilnya:

```bash
npm run db:migrate:status
```

Untuk bootstrap master data dan **satu** admin production, jalankan sekali. Script ini tidak membuat akun demo lokal.

```bash
export BOOTSTRAP_ADMIN_EMAIL='admin@perusahaan.com'
export BOOTSTRAP_ADMIN_PASSWORD='gunakan-password-kuat-minimal-12-karakter'
export BOOTSTRAP_ADMIN_NAME='Nama Administrator'
npm run db:seed:production
unset BOOTSTRAP_ADMIN_PASSWORD
```

Setelah itu, masuk dengan akun tersebut dan buat akun pengguna lain dari aplikasi. Jangan menjalankan `npm run db:seed` terhadap Neon karena itu adalah seed demo lokal.

### 3. Siapkan environment variables di Vercel

1. Buka [Vercel](https://vercel.com), login dengan GitHub, lalu pilih **Add New → Project**.
2. Import `prakosoharis/procurement`, pilih branch production `main`, dan biarkan framework terdeteksi sebagai **Next.js**.
3. Pada **Environment Variables**, tambahkan variabel berikut untuk target **Production** (dan Preview bila ingin deployment preview ikut memakai database terpisah):

| Nama | Nilai |
| --- | --- |
| `DATABASE_URL` | pooled connection string dari Neon production |
| `AUTH_SECRET` | secret acak minimal 32 byte; buat dengan `openssl rand -base64 48` |

Jangan isi `S3_ENDPOINT` dengan `http://minio:9000` pada Vercel. Itu hanya host internal Docker lokal. Tambahkan konfigurasi storage production nanti setelah keputusan Google Drive selesai.

4. Klik **Deploy**. Vercel menjalankan `npm ci` kemudian `npm run build`; build ini sudah menjalankan `prisma generate` tetapi **tidak** menjalankan migration otomatis. Migration sengaja dijalankan pada langkah 2 agar preview/redeploy tidak dapat mengubah database production secara tidak sengaja.
5. Setelah deployment selesai, buka URL `*.vercel.app`, login dengan admin bootstrap, dan uji halaman Dashboard, Repository, Request, Directory, serta logout.

### 4. Hubungkan domain dan URL yang stabil (opsional)

1. Di Vercel pilih project → **Settings → Domains**, lalu tambahkan domain perusahaan.
2. Ikuti record DNS yang diberikan Vercel sampai statusnya valid.
3. URL deployment preview memang berubah-ubah. Gunakan domain production atau URL production Vercel sebagai URL aplikasi yang stabil. Endpoint API aplikasi relatif (`/api/...`), sehingga tidak perlu diubah ketika domain berubah.

### 5. Alur deploy berikutnya

Untuk perubahan aplikasi biasa:

```bash
git add .
git commit -m "deskripsi perubahan"
git push origin main
```

Push ke `main` akan memicu deployment production Vercel. Pull request/branch lain sebaiknya memakai Preview Deployment dan database Neon terpisah agar data production tidak tercampur.

Untuk perubahan `prisma/schema.prisma`:

```bash
npx prisma migrate dev --name nama_perubahan
git add prisma/migrations prisma/schema.prisma
git commit -m "add database migration"
git push origin main
```

Sebelum atau tepat saat rilis production, jalankan migration yang sudah ter-commit ke database Neon production:

```bash
export DATABASE_URL='postgresql://...connection-string-neon-production...'
npm run db:migrate:deploy
```

Selalu backup data dan periksa SQL migration sebelum menjalankannya pada production. Jangan gunakan `prisma db push` atau `prisma migrate reset` terhadap Neon production.

### Checklist go-live

- [ ] `DATABASE_URL` Neon hanya tersimpan sebagai secret, bukan Git.
- [ ] `AUTH_SECRET` berbeda dari lokal dan cukup panjang.
- [ ] Migration status menunjukkan semua migration diterapkan.
- [ ] Tidak ada akun demo `demo12345` di production.
- [ ] Storage production untuk upload SOP sudah diputuskan dan diuji.
- [ ] Domain production, akses admin, dan logout sudah diuji.
- [ ] Backup/retention Neon dan batas penggunaan Vercel sudah ditinjau.

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
