import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  notice?: string;
}

function configFilePath(): string {
  return path.join(homedir(), ".config", "nodesign", "config.json");
}

function readConfig(): Record<string, any> {
  const file = configFilePath();
  if (!existsSync(file)) return {};
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(data: Record<string, any>): void {
  const file = configFilePath();
  const dir = path.dirname(file);
  mkdirSync(dir, { recursive: true });
  const current = readConfig();
  writeFileSync(file, `${JSON.stringify({ ...current, ...data }, null, 2)}\n`, "utf8");
}

function semverGt(v1: string, v2: string): boolean {
  const p1 = v1.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const n1 = p1[i] || 0;
    const n2 = p2[i] || 0;
    if (n1 > n2) return true;
    if (n1 < n2) return false;
  }
  return false;
}

export async function checkUpdateNotice(
  currentVersion: string,
  fetchFn: typeof fetch = globalThis.fetch,
  options: { forceCheck?: boolean } = {},
): Promise<UpdateCheckResult> {
  const config = readConfig();
  const now = Date.now();
  const lastCheck = typeof config.lastUpdateCheck === "number" ? config.lastUpdateCheck : 0;
  const cachedLatest = typeof config.latestVersion === "string" ? config.latestVersion : undefined;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  let latestVersion = cachedLatest;

  if (options.forceCheck || now - lastCheck > ONE_DAY_MS || !cachedLatest) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      const res = await fetchFn("https://registry.npmjs.org/@raquezha/nodesign/latest", {
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as any;
        if (typeof data?.version === "string") {
          latestVersion = data.version;
          writeConfig({
            lastUpdateCheck: now,
            latestVersion: data.version,
          });
        }
      }
    } catch {
      // Ignore network timeouts or offline errors cleanly
    }
  }

  if (latestVersion && semverGt(latestVersion, currentVersion)) {
    const line1 = `  Update available ${currentVersion} -> ${latestVersion}`;
    const line2 = `  Run 'npm install -g @raquezha/nodesign' to update`;
    const width = Math.max(line1.length, line2.length) + 4;
    const border = "─".repeat(width);

    const box = [
      `┌${border}┐`,
      `│${line1.padEnd(width)}│`,
      `│${line2.padEnd(width)}│`,
      `└${border}┘`,
    ].join("\n");

    return {
      hasUpdate: true,
      currentVersion,
      latestVersion,
      notice: box,
    };
  }


  return {
    hasUpdate: false,
    currentVersion,
    latestVersion,
  };
}
