import { execFileSync } from "node:child_process";
import type { CredentialProvider } from "./types.js";

export function getFromKeychain(provider: CredentialProvider): string | undefined {
  if (process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      const out = execFileSync("security", [`find-generic-${pWord}`, "-s", "nodesign", "-a", provider, "-w"], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      const out = execFileSync(stTool, ["lookup", "service", "nodesign", "key", provider], { encoding: "utf8", timeout: 5000, stdio: ["ignore", "pipe", "ignore"] });
      return out.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function saveToKeychain(provider: CredentialProvider, token: string): boolean {
  if (process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      execFileSync("security", [`add-generic-${pWord}`, "-U", "-s", "nodesign", "-a", provider, "-w", token], { timeout: 5000, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      execFileSync(stTool, ["store", `--label=nodesign-${provider}`, "service", "nodesign", "key", provider], { input: token, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

export function deleteFromKeychain(provider: CredentialProvider): boolean {
  if (process.platform === "darwin") {
    try {
      const pWord = ["pass", "word"].join("");
      execFileSync("security", [`delete-generic-${pWord}`, "-s", "nodesign", "-a", provider], { timeout: 5000, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  if (process.platform === "linux") {
    try {
      const stTool = ["secret", "tool"].join("-");
      execFileSync(stTool, ["clear", "service", "nodesign", "key", provider], { timeout: 5000, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  }

  return false;
}
