import { mkdtempSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function makeTempNotraceDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "notrace-test-"));
}

export function cleanupTempNotraceDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}
