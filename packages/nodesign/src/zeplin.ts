import { resolveCredentials, validateCredential, cleanTokenValue, fetchWithRateLimitRetry } from "./auth.js";
import {
  type ZeplinResolutionResult,
  normalizeProviderStatus,
  zeplinErrorDescription,
} from "./zeplin/types.js";
import { extractScreen, extractDetails } from "./zeplin/parser.js";
import { parseZeplinLink, parseZeplinProjectId, resolveZeplinShortlink, fetchSuggestedZeplinScreens } from "./zeplin/url.js";
import { renderZeplinScreen, downloadZeplinAssets } from "./zeplin/assets.js";

export * from "./zeplin/types.js";
export * from "./zeplin/parser.js";
export * from "./zeplin/url.js";

export async function resolveZeplinScreen(
  screenUrlOrId: string,
  providedToken?: string,
  outputDir?: string,
  fetchFn: typeof fetch = globalThis.fetch,
): Promise<ZeplinResolutionResult> {
  const parsedLink = parseZeplinLink(screenUrlOrId);
  let screenId = parsedLink.id;

  const rawToken = providedToken === undefined ? resolveCredentials().zeplinToken : providedToken || undefined;
  const authToken = cleanTokenValue(rawToken);

  if (!authToken) {
    return {
      status: "AUTH_REQUIRED",
      normalizedStatus: "AUTH_REQUIRED",
      errorDescription: zeplinErrorDescription("AUTH_REQUIRED"),
      note: "Zeplin access token is missing. Configure ZEPLIN_TOKEN environment variable or run `nodesign auth login`.",
    };
  }

  const zHeaders = {
    "Zeplin-Access-Token": authToken,
    Authorization: `Bearer ${authToken}`,
  };

  if (parsedLink.type === "project") {
    try {
      const projRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${screenId}`, { headers: zHeaders }, fetchFn);
      if (projRes.ok) {
        const projData = (await projRes.json()) as any;
        const screensRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${screenId}/screens?limit=20`, { headers: zHeaders }, fetchFn);
        const projScreens = screensRes.ok ? ((await screensRes.json()) as any[]) : [];
        const candidateNames = projScreens.map((s: any) => `${s.name} (${s.id})`);

        if (projScreens.length > 0) {
          const firstScreenRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/screens/${projScreens[0].id}`, { headers: zHeaders }, fetchFn);
          if (firstScreenRes.ok) {
            const screenData = (await firstScreenRes.json()) as any;
            const screen = extractScreen(screenData, projScreens[0].id);
            const extract = extractDetails(screenData, screen);
            return {
              status: "SUCCESS",
              normalizedStatus: "SUCCESS",
              screenId: projScreens[0].id,
              name: screen.name || projData.name,
              screen,
              extract,
              note: `Target link is project dashboard for '${projData.name}'. Loaded first project screen '${screen.name}'. Candidate screens:\n  • ${candidateNames.slice(0, 10).join("\n  • ")}`,
            };
          }
        }

        return {
          status: "DESIGN_NOT_FOUND",
          normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
          screenId,
          suggestedScreens: candidateNames.length ? candidateNames : undefined,
          errorDescription: `The provided link is a Zeplin project dashboard ('${projData.name}'), not a specific screen. Open a screen in Zeplin and copy its URL.`,
          note: candidateNames.length
            ? `Available screens in project '${projData.name}':\n  ${candidateNames.join("\n  ")}`
            : `Project '${projData.name}' has no accessible screens.`,
        };
      }
    } catch {}
  }

  if (!/^[0-9a-fA-F]{24}$/.test(screenId) && (screenUrlOrId.includes("zpl.io") || screenUrlOrId.startsWith("http"))) {
    const targetUrl = screenUrlOrId.startsWith("http") ? screenUrlOrId : `https://zpl.io/${screenId}`;
    const expandedId = await resolveZeplinShortlink(targetUrl, fetchFn);
    if (expandedId) screenId = expandedId;
  }

  try {
    let res = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/screens/${screenId}`, { headers: zHeaders }, fetchFn);

    if (res.status === 404) {
      const projectId = parseZeplinProjectId(screenUrlOrId);
      if (projectId) {
        const projScreenRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${projectId}/screens/${screenId}`, { headers: zHeaders }, fetchFn);
        if (projScreenRes.ok) res = projScreenRes;
      }
    }

    if (res.status === 404) {
      const compRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/components/${screenId}`, { headers: zHeaders }, fetchFn);
      if (compRes.ok) res = compRes;
    }

    if (res.status === 401) {
      return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), screenId, errorDescription: zeplinErrorDescription("AUTH_REJECTED"), note: "Zeplin authentication rejected (401 invalid token)" };
    }
    if (res.status === 403) {
      return { status: "ACCESS_DENIED", normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"), screenId, errorDescription: zeplinErrorDescription("ACCESS_DENIED"), note: "Zeplin access denied (403 forbidden)" };
    }
    if (res.status === 404) {
      const validity = await validateCredential("zeplin", authToken, fetchFn);
      if (validity === "invalid") {
        return { status: "AUTH_REJECTED", normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"), screenId, errorDescription: zeplinErrorDescription("AUTH_REJECTED"), note: "Zeplin authentication rejected (401 invalid token)" };
      }
      const projectId = parseZeplinProjectId(screenUrlOrId);
      let suggestedScreens: string[] = [];
      let projectContextNote = "";

      if (projectId) {
        try {
          const projRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${projectId}`, { headers: zHeaders }, fetchFn);
          if (projRes.ok) {
            const projData = (await projRes.json()) as any;
            projectContextNote = ` inside project '${projData.name}' (${projectId})`;
            const screensRes = await fetchWithRateLimitRetry(`https://api.zeplin.dev/v1/projects/${projectId}/screens?limit=15`, { headers: zHeaders }, fetchFn);
            if (screensRes.ok) {
              const screens = (await screensRes.json()) as any[];
              suggestedScreens = screens.map((s: any) => `${s.name} (${s.id})`);
            }
          }
        } catch {}
      }

      if (suggestedScreens.length === 0) {
        suggestedScreens = await fetchSuggestedZeplinScreens(authToken, fetchFn);
      }

      const errorDescription = zeplinErrorDescription("DESIGN_NOT_FOUND", screenId);
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        screenId,
        suggestedScreens: suggestedScreens.length ? suggestedScreens : undefined,
        errorDescription,
        note: suggestedScreens.length
          ? `${errorDescription}${projectContextNote ? ` (${projectContextNote.trim()})` : ""} Available screens:\n  • ${suggestedScreens.join("\n  • ")}`
          : errorDescription,
      };
    }
    if (res.status === 429) {
      return { status: "RATE_LIMITED", normalizedStatus: normalizeProviderStatus("RATE_LIMITED"), screenId, errorDescription: zeplinErrorDescription("RATE_LIMITED"), note: "Zeplin API rate limit exceeded (429)" };
    }
    if (!res.ok) {
      return { status: "API_UNAVAILABLE", normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"), screenId, errorDescription: zeplinErrorDescription("API_UNAVAILABLE"), note: `Zeplin API error (${res.status} ${res.statusText})` };
    }

    const data = (await res.json()) as any;
    const screen = extractScreen(data, screenId);
    const extract = extractDetails(data, screen);

    const visual = outputDir
      ? await renderZeplinScreen(screenId, authToken, outputDir, screen, extract, fetchFn)
      : {};
    const assetData = await downloadZeplinAssets(screenId, outputDir, zHeaders, fetchFn);

    return {
      status: "SUCCESS",
      normalizedStatus: "SUCCESS",
      screenId,
      name: screen.name,
      screen,
      extract,
      assets: assetData.assets,
      savedAssets: assetData.savedAssets,
      ...visual,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      status: "API_UNAVAILABLE",
      normalizedStatus: "API_UNAVAILABLE",
      screenId,
      errorDescription: zeplinErrorDescription("API_UNAVAILABLE"),
      note: `Network or fetch failure querying Zeplin API: ${msg}`,
    };
  }
}
