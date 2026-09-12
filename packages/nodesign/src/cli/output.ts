export const color = {
  dim: "\x1b[90m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  bold: "\x1b[1m",
  reset: "\x1b[0m",
};

export function statusColor(status: string): string {
  if (status === "SUCCESS") return color.green;
  if (status.includes("NOT_FOUND") || status.includes("REQUIRED")) return color.yellow;
  if (status.includes("REJECTED") || status.includes("DENIED")) return color.red;
  return color.cyan;
}

export function printStep(label: string, value?: string): void {
  if (!value) return;
  console.log(`${color.cyan}◇${color.reset} ${color.bold}${label}${color.reset} ${color.dim}›${color.reset} ${value}`);
}

export function printList(title: string, items: string[] = []): void {
  if (!items.length) return;
  console.log(`${color.cyan}│${color.reset}`);
  console.log(`${color.cyan}◇${color.reset} ${color.bold}${title}${color.reset}`);
  for (const item of items) console.log(`${color.cyan}│${color.reset}  ${color.dim}•${color.reset} ${item}`);
}

export function printNote(provider: string, note?: string): void {
  if (!note) return;
  console.log(`${color.cyan}│${color.reset}`);
  console.log(`${color.yellow}◆${color.reset} ${color.bold}${provider} note${color.reset}`);
  console.log(`${color.cyan}│${color.reset}  ${note}`);
}
