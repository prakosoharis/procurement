-- A Drive folder ID is cached for fast resolution, not a business key. Folder
-- identity is still checked through Google Drive before use, so a database
-- uniqueness constraint is unnecessary and blocks safe local schema startup.
DROP INDEX IF EXISTS "BusinessUnit_googleDriveFolderId_key";
