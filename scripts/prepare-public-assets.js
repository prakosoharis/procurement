const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'procurement-governance-hub (1).html');
const destination = path.join(root, 'public', 'procurement-governance-hub.html');

if (!fs.existsSync(source)) {
  throw new Error(`Dashboard source tidak ditemukan: ${source}`);
}

// Vercel does not reliably expose a public asset that is represented by a
// symlink. Replace the local symlink with a real static file before Next.js
// collects public assets for a build.
fs.rmSync(destination, { force: true });
fs.copyFileSync(source, destination);
console.log('Public dashboard asset prepared.');
