import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as os from "node:os";
import * as fs from "node:fs";

/**
 * noleaks extension
 *
 * Opinionated defense-in-depth guard for Pi tool calls. It blocks common ways
 * an agent can read, enumerate, print, transform, or exfiltrate credentials.
 * This is not a sandbox; it is a deliberately conservative policy layer.
 */
export default function (pi: ExtensionAPI) {
  const configPath = path.join(os.homedir(), ".pi", "agent", "noleaks.json");
  let mode: "max" | "basic" | "off" = "max";
  const stats = { blocked: 0, redacted: 0 };

  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (config.mode) mode = config.mode;
    }
  } catch {}

  function saveConfig() {
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(configPath, JSON.stringify({ mode }), "utf8");
    } catch {}
  }

  try {
    const statusIcon = mode === "off" ? "🔓" : "🔒";
    if (typeof (pi as any).log === "function") {
      (pi as any).log(`${statusIcon} noleaks active (mode: ${mode})`);
    } else {
      console.log(`${statusIcon} noleaks active (mode: ${mode})`);
    }
  } catch {}

  const blockedFileNames = [".env", ".npmrc", ".netrc", ".pypirc", ".dockercfg", "auth.json", "credentials", "credentials.json", "known_hosts"];
  const blockedFilePrefixes = [".env.", "id_rsa", "id_ed25519", "id_ecdsa", "id_dsa"];
  const blockedExtensions = [".pem", ".key", ".p12", ".pfx", ".keystore", ".jks"];
  const blockedDirNames = [".aws", ".azure", ".config/gcloud", ".docker", ".gnupg", ".kube", ".secrets", ".pi-secrets", ".ssh"];

  const blockedAbsolutePaths = [
    path.join(os.homedir(), ".pi-secrets"),
    path.join(os.homedir(), ".ssh"),
    path.join(os.homedir(), ".aws"),
    path.join(os.homedir(), ".azure"),
    path.join(os.homedir(), ".config", "gcloud"),
    path.join(os.homedir(), ".docker"),
    path.join(os.homedir(), ".gnupg"),
    path.join(os.homedir(), ".kube"),
    path.join(os.homedir(), ".npmrc"),
    path.join(os.homedir(), ".netrc"),
    path.join(os.homedir(), ".pypirc"),
    path.join(os.homedir(), ".pi", "agent", "auth.json"),
  ];

  const secretKeyRe = /(^|[^a-z0-9])(authorization|cookie|password|passwd|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|credential|refresh[_-]?token|id[_-]?token)([^a-z0-9]|$)/i;
  const secretValueRe = /(bearer\s+[a-z0-9._~+/=-]{12,}|sk-[a-z0-9_-]{16,}|gh[pousr]_[a-z0-9_]{16,}|xox[baprs]-[a-z0-9-]{16,}|AKIA[0-9A-Z]{16}|[0-9a-f]{32,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;
  const secretAssignmentRe = /(^|\n)\s*[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIAL|AUTH_?KEY|AUTH_?TOKEN|CONNECTION_?STRING|DSN)[A-Z0-9_]*\s*=\s*[^\s]+/i;

  const readOrTransformCommands = ["cat", "less", "more", "head", "tail", "grep", "egrep", "fgrep", "rg", "sed", "awk", "perl", "python", "python3", "ruby", "node", "jq", "yq", "cp", "mv", "scp", "rsync", "tar", "zip", "gzip", "gunzip", "base64", "xxd", "hexdump", "strings", "openssl", "gpg", "vi", "vim", "nvim", "nano", "code", "open", "bat", "source", ".", "ls-tree", "git show", "git cat-file"];
  const envDumpRe = /(^|[;&|\s])(env|printenv|set|export)(\s*(#.*)?$|\s*[;&|>])/;
  const exfilCommandRe = /\b(curl|wget|nc|ncat|netcat|socat|ftp|sftp|ssh|scp|rsync|openssl\s+s_client|telnet|tftp)\b/;
  const sensitiveShellExpansionRe = /\$(\{)?[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|PASSWD|API_?KEY|ACCESS_?KEY|PRIVATE_?KEY|CREDENTIAL)[A-Z0-9_]*(\})?/i;

  function isPathUnder(parent: string, candidate: string): boolean {
    const relative = path.relative(path.resolve(parent), path.resolve(candidate));
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  }

  function expandHome(rawPath: string): string {
    if (rawPath === "~") return os.homedir();
    if (rawPath.startsWith(`~${path.sep}`) || rawPath.startsWith("~/")) {
      return path.join(os.homedir(), rawPath.slice(2));
    }
    return rawPath;
  }

  function normalizeForCheck(rawPath: string, cwd: string): string {
    const expanded = expandHome(rawPath.replace(/^file:\/\//, ""));
    const resolved = path.resolve(cwd, expanded);
    try {
      return fs.realpathSync(resolved);
    } catch {
      return resolved;
    }
  }

  function checkPath(rawPath: unknown, cwd: string): string | undefined {
    if (typeof rawPath !== "string" || rawPath.trim() === "") return undefined;
    const resolved = normalizeForCheck(rawPath, cwd);
    const lower = resolved.toLowerCase();

    for (const blockedPath of blockedAbsolutePaths) {
      if (isPathUnder(blockedPath, resolved)) return `path is under protected location "${blockedPath}"`;
    }

    const lowerSegments = lower.split(path.sep).filter(Boolean);
    const lowerPath = lowerSegments.join("/");
    for (const blockedDir of blockedDirNames) {
      if (blockedDir.includes("/")) {
        if (lowerPath.includes(blockedDir.toLowerCase())) return `path contains protected directory "${blockedDir}"`;
      } else if (lowerSegments.includes(blockedDir.toLowerCase())) {
        return `path contains protected directory "${blockedDir}"`;
      }
    }

    const basename = path.basename(lower);
    if (blockedFileNames.includes(basename)) return `file matches blocked name "${basename}"`;
    for (const prefix of blockedFilePrefixes) {
      if (basename.startsWith(prefix.toLowerCase())) return `file matches blocked prefix "${prefix}"`;
    }
    for (const ext of blockedExtensions) {
      if (basename.endsWith(ext)) return `file matches blocked extension "${ext}"`;
    }
    return undefined;
  }

  function hasSecretMaterial(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === "string") return secretValueRe.test(value) || secretAssignmentRe.test(value);
    if (typeof value !== "object") return false;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (secretKeyRe.test(key) || hasSecretMaterial(item)) return true;
    }
    return false;
  }

  function shellWords(command: string): string[] {
    return command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map((word) => word.replace(/^['"]|['"]$/g, "")) ?? [];
  }

  function checkBashCommand(command: unknown, cwd: string): string | undefined {
    if (typeof command !== "string" || command.trim() === "") return undefined;

    // Obfuscation checks are intentionally separate from action checks.
    // Normal shell whitespace (space, tab, CR, LF) is allowed so multi-line
    // commands are not treated as control-character obfuscation.
    const nfkc = command.normalize("NFKC");
    if (nfkc !== command) {
      return "command rejected: Unicode normalization variance detected (possible obfuscation)";
    }

    const suspiciousControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\ufeff\u2060-\u2069]/;
    if (suspiciousControls.test(command)) {
      return "command rejected: hidden/control characters detected (possible obfuscation)";
    }

    const normalized = nfkc;
    const deobfuscated = normalized.replace(/\\(.)/g, "$1").replace(/['"]/g, "");
    const cmd = normalized.toLowerCase();
    const deobfuscatedLower = deobfuscated.toLowerCase();

    if (envDumpRe.test(cmd)) return "command attempts to dump environment variables";
    if (sensitiveShellExpansionRe.test(command)) return "command references sensitive environment variable names";

    const transformTools = ["base64", "xxd", "openssl", "gpg", "hexdump"];
    const hasTransformTool = transformTools.some(tool => deobfuscatedLower.includes(tool));
    if (hasTransformTool && (cmd.includes("|") || cmd.includes(">") || cmd.includes("<"))) {
      if (secretValueRe.test(command) || secretAssignmentRe.test(command)) return "command attempts to transform or smuggle secret-looking material";
    }

    const discoveryAndExfil = ["curl", "wget", "nc", "netcat", "ncat", "socat", "ftp", "sftp", "ssh", "scp", "rsync", "nmap", "tcpdump", "wireshark", "telnet", "tftp"];
    const hasExfilTool = discoveryAndExfil.some(tool => deobfuscatedLower.includes(tool));
    if (hasExfilTool && (secretKeyRe.test(command) || /\b(env|printenv|set|export)\b/.test(cmd))) {
      return "command combines network discovery/transfer with sensitive material";
    }

    const words = shellWords(normalized);
    // Universal Word Scanning (VTSTech-style): Check every word in the command
    for (const word of words) {
      const baseWord = path.basename(word.toLowerCase());
      const pathReason = checkPath(word, cwd);
      if (pathReason && mode === "max") return `command references protected path: ${word}`;

      // Block critical system utilities even as arguments (e.g. sudo chmod)
      if (["chmod", "chown", "passwd", "useradd", "userdel", "mkfs", "dd", "shred"].includes(baseWord)) {
        return `command uses critical system utility: ${baseWord}`;
      }
    }

    const commandMentionsSensitivePath = words.some((word) => checkPath(word, cwd));
    const commandReadsOrTransforms = words.some((word) => readOrTransformCommands.includes(path.basename(word.toLowerCase())));
    if (commandMentionsSensitivePath && commandReadsOrTransforms && mode === "max") return "command appears to read or transform sensitive files";
    if (secretValueRe.test(command)) return "command contains secret-looking material";
    return undefined;
  }

  function redactSecrets(text: string): string {
    let redacted = text;
    redacted = redacted.replace(secretAssignmentRe, (match) => {
      const parts = match.split("=");
      if (parts.length >= 2) return `${parts[0]}=[REDACTED]`;
      return "[REDACTED_ASSIGNMENT]";
    });
    redacted = redacted.replace(secretValueRe, "[REDACTED_SECRET]");
    return redacted;
  }

  pi.registerCommand("noleaks", {
    description: "Manage noleaks security mode and view stats",
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/);
      const sub = parts[0]?.toLowerCase();

      if (sub === "mode") {
        const val = parts[1]?.toLowerCase();
        if (val === "max" || val === "basic" || val === "off") {
          mode = val as any;
          saveConfig();
          ctx.ui.notify(`noleaks mode set to ${mode.toUpperCase()}`, "info");
          if (ctx.hasUI) {
            (ctx.ui as any).setExtensionStatus("noleaks", mode === "off" ? "🔓" : "🔒");
          }
          return;
        }
      }

      const report = [
        "🔒 noleaks security status",
        `Mode: ${mode.toUpperCase()}`,
        `Blocked calls: ${stats.blocked}`,
        `Redacted secrets: ${stats.redacted}`,
        "",
        "Modes:",
        "  max: Block sensitive paths + Scrub output (Default)",
        "  basic: Allow path access + Scrub output (DLP only)",
        "  off: Disable all protection",
        "",
        "Usage: /noleaks mode [max|basic|off]",
      ].join("\n");

      pi.sendMessage({
        customType: "noleaks-report",
        content: report,
        display: true,
      });
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    if (ctx.hasUI && typeof (ctx.ui as any).setExtensionStatus === "function") {
      (ctx.ui as any).setExtensionStatus("noleaks", mode === "off" ? "🔓" : "🔒");
    }
  });

  pi.on("tool_result", async (event, ctx) => {
    if (mode === "off" || event.isError) return undefined;
    let modified = false;
    const newContent = event.content.map((item) => {
      if (item.type === "text") {
        const redacted = redactSecrets(item.text);
        if (redacted !== item.text) {
          modified = true;
          stats.redacted++;
          return { ...item, text: redacted };
        }
      }
      return item;
    });

    if (modified) {
      if (ctx.hasUI) ctx.ui.notify("noleaks: Scrubbed potential secret from tool output", "warning");
      return { content: newContent };
    }
    return undefined;
  });

  pi.on("tool_call", async (event, ctx) => {
    if (mode === "off") return undefined;
    const { toolName, input } = event;
    const cwd = typeof (ctx as any).cwd === "string" ? (ctx as any).cwd : process.cwd();

    switch (toolName) {
      case "read":
      case "write":
      case "edit": {
        if (mode === "max") {
          const reason = checkPath((input as any).path, cwd);
          if (reason) {
            stats.blocked++;
            return { block: true, reason: `🚫 Blocked: ${reason}` };
          }
        }
        if ((toolName === "write" || toolName === "edit") && hasSecretMaterial(input)) {
          stats.blocked++;
          return { block: true, reason: "🚫 Blocked: write/edit payload contains secret-looking material" };
        }
        break;
      }
      case "bash": {
        const reason = checkBashCommand((input as any).command, cwd);
        if (reason) {
          if (mode === "max" || reason.includes("secret-looking material") || reason.includes("dump environment")) {
            stats.blocked++;
            return { block: true, reason: `🚫 Blocked: ${reason}` };
          }
        }
        break;
      }
      case "grep":
      case "multi_grep":
      case "find":
      case "ls": {
        if (mode === "max") {
          const pathArg = (input as any).path;
          const reason = checkPath(pathArg, cwd);
          if (reason) {
            stats.blocked++;
            return { block: true, reason: `🚫 Blocked: ${reason}` };
          }
        }
        if (hasSecretMaterial(input)) {
          stats.blocked++;
          return { block: true, reason: "🚫 Blocked: search/list payload references secret-looking material" };
        }
        break;
      }
    }
    return undefined;
  });
}
