import test from 'node:test';
import assert from 'node:assert/strict';
import {
  driveFolderName,
  ensureSopBusinessUnitFolder,
  googleDriveFileId,
  moveGoogleDriveFile,
  resolveGoogleDriveFolderPath,
  sopDriveFileName
} from '../lib/google-drive-folders.js';
import { ensureGoogleDriveRootFolder } from '../lib/google-drive.js';

function fakeDrive() {
  const folders = new Map();
  const files = new Map();
  let sequence = 0;
  return {
    folders,
    files,
    filesApi: {
      async list({ q }) {
        const name = /name = '([^']+)'/.exec(q)?.[1];
        const parent = /'([^']+)' in parents/.exec(q)?.[1];
        const found = [...folders.values()].filter((folder) => folder.name === name && folder.parents.includes(parent));
        return { data: { files: found } };
      },
      async create({ requestBody }) {
        const id = `folder-${++sequence}`;
        const folder = { id, name: requestBody.name, mimeType: requestBody.mimeType, parents: requestBody.parents, trashed: false };
        folders.set(id, folder);
        return { data: folder };
      },
      async get({ fileId }) {
        const item = folders.get(fileId) || files.get(fileId);
        if (!item) {
          const error = new Error('not found');
          error.code = 404;
          throw error;
        }
        return { data: item };
      },
      async update({ fileId, addParents, removeParents }) {
        const file = files.get(fileId);
        const removed = removeParents ? removeParents.split(',') : [];
        file.parents = [...new Set([...(addParents ? [addParents] : []), ...file.parents.filter((parent) => !removed.includes(parent))])];
        return { data: file };
      }
    },
    drive() {
      return { files: this.filesApi };
    }
  };
}

test('folder names and Drive file keys are safe and durable', () => {
  assert.equal(driveFolderName(' SMI / Internal '), 'SMI - Internal');
  assert.equal(googleDriveFileId('gdrive:file-123'), 'file-123');
  assert.equal(googleDriveFileId('s3:legacy'), null);
  assert.equal(sopDriveFileName({ title: 'SOP / Pengadaan', versionNo: 'v1.0', fileName: 'source.pdf' }), 'SOP - Pengadaan — v1.0 — source.pdf');
});

test('SOP folder resolution is idempotent and stores the BU folder ID', async () => {
  const fake = fakeDrive();
  const db = { businessUnit: { updates: [], async update(input) { this.updates.push(input); } } };
  const context = { drive: fake.drive(), rootFolderId: 'root' };
  const businessUnit = { id: 'bu-smi', name: 'SMI', googleDriveFolderId: null };

  const first = await ensureSopBusinessUnitFolder({ businessUnit, db, ...context });
  const second = await resolveGoogleDriveFolderPath({ segments: ['SOP', 'SMI'], create: true, ...context });

  assert.equal(first.complete, true);
  assert.equal(first.folderId, second.folderId);
  assert.equal(fake.folders.size, 2);
  assert.deepEqual(db.businessUnit.updates[0], { where: { id: 'bu-smi' }, data: { googleDriveFolderId: first.folderId } });
});

test('moving a Drive file changes its parent without changing the durable file ID', async () => {
  const fake = fakeDrive();
  fake.files.set('file-1', { id: 'file-1', name: 'SOP.pdf', parents: ['root'], trashed: false });
  const result = await moveGoogleDriveFile({ fileId: 'file-1', targetFolderId: 'bu-folder', drive: fake.drive(), rootFolderId: 'root' });

  assert.equal(result.moved, true);
  assert.equal(result.fileId, 'file-1');
  assert.deepEqual(fake.files.get('file-1').parents, ['bu-folder']);
});

test('Google Drive reconnect reuses a valid root folder', async () => {
  const fake = fakeDrive();
  fake.folders.set('root', { id: 'root', mimeType: 'application/vnd.google-apps.folder', parents: [], trashed: false });
  const root = await ensureGoogleDriveRootFolder({ drive: fake.drive(), existingFolderId: 'root' });
  assert.deepEqual(root, { folderId: 'root', reused: true });
  assert.equal(fake.folders.size, 1);
});
