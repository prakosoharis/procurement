const { spawn } = require('child_process');

const neonUrl = process.env.NEON_DATABASE_URL;
if (!neonUrl) {
  console.error('NEON_DATABASE_URL belum diisi. Connection string tidak boleh disimpan di Git.');
  process.exit(1);
}
if (process.env.CONFIRM_NEON_REPLACE !== 'REPLACE_NEON_DATA') {
  console.error('Perintah dibatalkan. Ini akan mengganti seluruh data Neon dengan PostgreSQL Docker lokal.');
  console.error('Jalankan kembali dengan CONFIRM_NEON_REPLACE=REPLACE_NEON_DATA jika Anda yakin.');
  process.exit(1);
}

const dump = spawn('docker', ['compose', 'exec', '-T', 'postgres', 'pg_dump', '-U', 'procurement', '--format=custom', '--no-owner', '--no-privileges', 'procurement'], {
  stdio: ['ignore', 'pipe', 'inherit']
});
const restore = spawn('docker', ['run', '--rm', '-i', '-e', 'NEON_DATABASE_URL', 'postgres:16-alpine', 'sh', '-c', 'pg_restore --clean --if-exists --no-owner --no-privileges --dbname="$NEON_DATABASE_URL"'], {
  env: { ...process.env, NEON_DATABASE_URL: neonUrl },
  stdio: ['pipe', 'inherit', 'inherit']
});

dump.stdout.pipe(restore.stdin);
dump.on('error', fail);
restore.on('error', fail);
dump.on('close', (code) => {
  if (code !== 0) fail(`Ekspor PostgreSQL lokal gagal (exit ${code}).`);
});
restore.on('close', (code) => {
  if (code !== 0) fail(`Restore ke Neon gagal (exit ${code}).`);
  console.log('\nData PostgreSQL Docker lokal berhasil disalin ke Neon.');
});

let failed = false;
function fail(message) {
  if (failed) return;
  failed = true;
  dump.kill('SIGTERM');
  restore.kill('SIGTERM');
  console.error(message);
  process.exitCode = 1;
}
