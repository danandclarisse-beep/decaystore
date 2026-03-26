-- Fix folder parent_id foreign key: change ON DELETE CASCADE to ON DELETE SET NULL
-- to align with the app-level behavior (sub-folders move to root on parent delete).
-- CASCADE would silently delete sub-folders, which is not what the DELETE handler does.

ALTER TABLE "folders" DROP CONSTRAINT IF EXISTS "folders_parent_id_folders_id_fk";
ALTER TABLE "folders"
  ADD CONSTRAINT "folders_parent_id_folders_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "folders"("id") ON DELETE SET NULL;