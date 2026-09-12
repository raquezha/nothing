export function parseZeplinProjectId(url: string): string | undefined {
  const match = url.match(/app\.zeplin\.io\/project\/([a-fA-F0-9]{24})/i) || url.match(/[?&]pid=([a-fA-F0-9]{24})/i);
  return match ? match[1] : undefined;
}

export function parseZeplinScreenId(urlOrId: string): string {
  const clean = urlOrId.trim().replace(/[.,;)\]>]+$/, "");
  const sidMatch = clean.match(/[?&](?:sid|screenId|screen_id|coid|coId)=([^&?#]+)/i);
  if (sidMatch) return sidMatch[1];

  if (clean.includes("/screen/")) {
    const parts = clean.split("/screen/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }

  if (clean.startsWith("zpl://")) {
    const match = clean.match(/(?:screen\/|screen:|components\/|component:)([^/?#]+)/i);
    if (match) return match[1];
  }

  if (clean.includes("zpl.io/")) {
    const parts = clean.split("zpl.io/");
    return parts[1].split(/[?#]/)[0].replace(/\/$/, "");
  }

  const pidMatch = clean.match(/[?&]pid=([^&?#]+)/i);
  if (pidMatch) return pidMatch[1];

  const projMatch = clean.match(/app\.zeplin\.io\/project\/([a-fA-F0-9]{24})/i);
  if (projMatch) return projMatch[1];

  return clean;
}

export function parseZeplinLink(rawUrl: string): { type: "screen" | "project" | "unknown"; id: string; projectId?: string } {
  const clean = rawUrl.trim().replace(/[.,;)\]>]+$/, "");
  const projectId = parseZeplinProjectId(clean);

  if (clean.includes("/screen/") || /[?&](?:sid|screenId|screen_id|coid|coId)=/i.test(clean) || clean.includes("zpl.io/") || clean.startsWith("zpl://screen")) {
    return { type: "screen", id: parseZeplinScreenId(clean), projectId };
  }

  if (projectId || clean.includes("app.zeplin.io/project/") || clean.startsWith("zpl://project")) {
    const id = projectId || parseZeplinScreenId(clean);
    return { type: "project", id, projectId: id };
  }

  return { type: "unknown", id: clean, projectId };
}

export async function resolveZeplinShortlink(
  url: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<string | undefined> {
  const cleanUrl = url.trim().replace(/[.,;)\]>]+$/, "");
  if (!cleanUrl.startsWith("http")) return undefined;

  try {
    const res = await fetchFn(cleanUrl, { method: "HEAD", redirect: "manual" });
    const location = res.headers?.get?.("location") || res.headers?.get?.("Location");
    if (location) {
      const expanded = parseZeplinScreenId(location);
      if (expanded && expanded !== cleanUrl && expanded.length > 5) return expanded;
    }

    const getRes = await fetchFn(cleanUrl, { redirect: "follow" });
    if (getRes.url && getRes.url !== cleanUrl) {
      const expanded = parseZeplinScreenId(getRes.url);
      if (expanded && expanded !== cleanUrl && expanded.length > 5) return expanded;
    }
  } catch {}
  return undefined;
}

export async function fetchSuggestedZeplinScreens(
  authToken: string,
  fetchFn: typeof fetch,
): Promise<string[]> {
  try {
    const zHeaders = { "Zeplin-Access-Token": authToken, Authorization: `Bearer ${authToken}` };
    const projRes = await fetchFn("https://api.zeplin.dev/v1/projects", { headers: zHeaders });
    if (!projRes.ok) return [];
    const projects = (await projRes.json()) as any[];
    const candidates: string[] = [];

    for (const proj of (projects || []).slice(0, 3)) {
      const screensRes = await fetchFn(`https://api.zeplin.dev/v1/projects/${proj.id}/screens?limit=5`, { headers: zHeaders });
      if (screensRes.ok) {
        const screens = (await screensRes.json()) as any[];
        for (const s of screens || []) {
          candidates.push(`${s.name} (${s.id})`);
        }
      }
    }
    return candidates.slice(0, 10);
  } catch {
    return [];
  }
}
