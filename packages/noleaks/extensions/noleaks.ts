import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as os from "node:os";

/**
 * env-protection extension
 *
 * Blocks pi (and any LLM) from reading, writing, grepping, or listing
 * sensitive files: .env, private keys, credentials, and the ~/.pi-secrets
 * directory. Protects against accidental secret exposure to AI models.
 *
 * Safe operations like `source ~/.pi-secrets/.env` in setup scripts
 * are unaffected — they run outside pi.
 */
export default function (pi: ExtensionAPI) {
  // Log activation message when the extension is loaded
  try {
    // prefer pi.log if available, otherwise console
    if (typeof (pi as any).log === "function") {
      (pi as any).log("🔒 noleaks active — secrets are guarded");
    } else {
      console.log("🔒 noleaks active — secrets are guarded");
    }
  } catch (e) {
    // best-effort: don't crash extension on logging failure
    try { console.log("🔒 noleaks active — secrets are guarded"); } catch {}
  }


  // ── File-name patterns (matched against basename + full path) ──────
  const blockedFilePatterns = [
    ".env",
    ".env.",
    "credentials",
    ".pem",
    ".key",
    "id_rsa",
    "id_ed25519",
    "id_ecdsa",
    "id_dsa",
    ".p12",
    ".pfx",
    ".keystore",
    ".jks",
    "auth.json",
  ];

  // ── Directory patterns (always blocked regardless of file name) ────
  const blockedDirPatterns = [
    ".secrets",
    ".pi-secrets",
    ".ssh",
  ];

  // ── Resolved absolute paths that are always blocked ────────────────
  const blockedAbsolutePaths = [
    path.join(os.homedir(), ".pi-secrets"),
    path.join(os.homedir(), ".ssh"),
    path.join(os.homedir(), ".pi", "agent", "auth.json"),
  ];

  // Pre-calculate sets for faster lookups
  const blockedFileSet = new Set(blockedFilePatterns);
  const blockedDirSet = new Set(blockedDirPatterns);

  // ── Helpers ────────────────────────────────────────────────────────

  function checkPath(filePath: string): string | undefined {
    if (!filePath) return undefined;

    const resolved = path.resolve(filePath);
    const lower = resolved.toLowerCase();
    
    // Check absolute blocked paths (most specific)
    for (const bp of blockedAbsolutePaths) {
      if (resolved.startsWith(bp)) {
        return `path is under protected location "${bp}"`;
      }
    }

    // Check directory patterns via path segments (faster than full string includes)
    const segments = lower.split(path.sep);
    for (const segment of segments) {
      if (blockedDirSet.has(segment)) {
        return `path contains protected directory "${segment}"`;
      }
    }

    // Check file-name patterns
    const basename = path.basename(filePath).toLowerCase();
    if (blockedFileSet.has(basename)) {
       return `file matches blocked pattern "${basename}"`;
    }
    // Prefix match for things like .env.local
    for (const fp of blockedFilePatterns) {
      if (basename.startsWith(fp)) {
        return `file matches blocked pattern "${fp}"`;
      }
    }

    return undefined;
  }

  // Regex for fast command checking
  const readPrefixes = [
    "cat", "less", "more", "head", "tail", "grep", "egrep", "fgrep", "rg",
    "sed", "awk", "cp", "mv", "scp", "vi", "vim", "nvim", "nano", "code",
    "open", "bat", "source", "\\.", "base64", "xxd", "hexdump"
  ];
  const readRegex = new RegExp(`\\b(${readPrefixes.join("|")})\\b`);
  const filePatternRegex = new RegExp(`(${blockedFilePatterns.map(p => p.replace(/\./g, "\\.")).join("|")})`);

  function checkBashCommand(command: string): string | undefined {
    const cmd = command.toLowerCase();

    // 1. Fast check for blocked directory names
    for (const dp of blockedDirPatterns) {
      if (cmd.includes(dp)) {
        return `command references protected directory "${dp}"`;
      }
    }

    // 2. Fast check for absolute paths
    for (const bp of blockedAbsolutePaths) {
      if (cmd.includes(bp.toLowerCase())) {
        return `command references protected path "${bp}"`;
      }
    }

    // 3. Combined regex check for read commands + sensitive files
    if (filePatternRegex.test(cmd) && readRegex.test(cmd)) {
      return `command appears to read sensitive files`;
    }

    return undefined;
  }

  // ── Intercept tool calls ───────────────────────────────────────────

  pi.on("session_start", async (event, ctx) => {
    if (ctx.hasUI && typeof (ctx.ui as any).setExtensionStatus === "function") {
      (ctx.ui as any).setExtensionStatus("noleaks", "🔒");
    }
  });

  pi.on("tool_call", async (event, _ctx) => {
    const { toolName, input } = event;

    // Fast switch on tool name
    switch (toolName) {
      case "read":
      case "write":
      case "edit": {
        const reason = checkPath((input as any).path);
        if (reason) return { block: true, reason: `🔒 Blocked: ${reason}` };
        break;
      }

      case "bash": {
        const reason = checkBashCommand((input as any).command);
        if (reason) return { block: true, reason: `🔒 Blocked: ${reason}` };
        break;
      }

      case "grep":
      case "multi_grep":
      case "find":
      case "ls": {
        const pathArg = (input as any).path;
        if (pathArg) {
          const reason = checkPath(pathArg);
          if (reason) return { block: true, reason: `🔒 Blocked: ${reason}` };
        }
        break;
      }
    }

    return undefined;
  });


}
