import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export async function publishPreview(tempDir, finalDir, fileSystem = fs) {
  const backupDir = path.join(path.dirname(finalDir), `.${path.basename(finalDir)}.backup-${crypto.randomUUID()}`);
  let hasBackup = false;
  try {
    await fileSystem.rename(finalDir, backupDir);
    hasBackup = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  try {
    await fileSystem.rename(tempDir, finalDir);
  } catch (error) {
    if (hasBackup) await fileSystem.rename(backupDir, finalDir);
    throw error;
  }
  if (hasBackup) await fileSystem.rm(backupDir, { recursive: true, force: true });
}
