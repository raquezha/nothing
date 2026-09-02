import type { DateValue, MaybeNumber, MaybeString, Repoish, Taskish } from "./types.js";

export function parseDate(value: DateValue): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateDay(value: DateValue): string {
  const date = parseDate(value);
  return date ? date.toISOString().slice(0, 10) : String(value ?? "");
}

export function formatTimeMinutes(value: DateValue): string {
  const date = parseDate(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : String(value ?? "");
}

export function formatTimeSeconds(value: DateValue): string {
  const date = parseDate(value);
  return date ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : String(value ?? "");
}

export function workflowDisplayName(workflow: MaybeString): string {
  switch (workflow) {
    case "norpiv":
      return "RPIV";
    case "research":
      return "Research";
    case "generic":
    default:
      return "Generic";
  }
}

export function workflowClassName(workflow: MaybeString): string {
  switch (workflow) {
    case "norpiv":
      return "workflow-rpiv";
    case "research":
      return "workflow-research";
    case "generic":
    default:
      return "workflow-generic";
  }
}

export function taskDisplay(taskish: Taskish): string {
  const task = taskish?.task || taskish;
  const workflow = task?.workflow || taskish?.workflow || "generic";
  const taskId = (task as any)?.id ?? taskish?.taskId;
  if (taskId) {
    if (workflow === "research" && String(taskId).startsWith("branch:")) {
      return `Branch ${String(taskId).slice(7)}`;
    }
    return String(taskId);
  }
  if (workflow === "research") return "Open research";
  if (workflow === "generic") return "General session";
  return "No active task";
}

export function resolveRepoName(data: Repoish): string {
  const name = data?.repository?.name || data?.repositoryName || data?.repoName || "Repository";
  const branch = data?.repository?.branch;
  return branch ? `${name} @ ${branch}` : name;
}

export function formatUsd(value: MaybeNumber): string {
  const num = Number(value || 0);
  if (num === 0) return "$0";
  return `$${num.toFixed(5)}`;
}

export function formatTokens(value: MaybeNumber): string {
  const num = Number(value || 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toString();
}

export function formatMs(value: MaybeNumber): string {
  const ms = Number(value || 0);
  if (!ms) return "-";
  const totalSeconds = Math.round(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function formatTelemetryStatus(value: MaybeString): string {
  switch (value) {
    case "active":
      return "Active";
    case "loaded-disabled":
      return "Loaded disabled";
    case "loaded-inactive":
      return "Loaded inactive";
    case "blocked":
      return "Blocked";
    case "absent":
      return "Absent";
    case "unknown":
    default:
      return "Unknown";
  }
}
