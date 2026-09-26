import {
  resolveCredentials,
  validateCredential,
  cleanTokenValue,
  fetchWithRateLimitRetry,
} from "./auth.js";
import {
  type ZeplinResolutionResult,
  type ZeplinErrorStatus,
  normalizeProviderStatus,
  zeplinErrorDescription,
} from "./zeplin/types.js";
import { extractScreen, extractDetails } from "./zeplin/parser.js";
import {
  parseZeplinLink,
  parseZeplinProjectId,
  resolveZeplinShortlinkTarget,
  fetchSuggestedZeplinScreens,
} from "./zeplin/url.js";
import { renderZeplinScreen, downloadZeplinAssets } from "./zeplin/assets.js";

export * from "./zeplin/types.js";
export * from "./zeplin/parser.js";
export * from "./zeplin/url.js";

export async function resolveZeplinScreen(
  screenUrlOrId: string,
  providedToken?: string,
  outputDir?: string,
  fetchFn: typeof fetch = globalThis.fetch
): Promise<ZeplinResolutionResult> {
  const parsedLink = parseZeplinLink(screenUrlOrId);
  let screenId = parsedLink.id;
  let projectId = parsedLink.projectId;

  const rawToken =
    providedToken === undefined
      ? resolveCredentials().zeplinToken
      : providedToken || undefined;
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
    return {
      status: "DESIGN_NOT_FOUND",
      normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
      screenId,
      errorDescription: "A Zeplin project dashboard is not a screen. Open the intended screen and copy its direct URL.",
    };
  }

  if (
    !/^[0-9a-fA-F]{24}$/.test(screenId) &&
    (screenUrlOrId.includes("zpl.io") || screenUrlOrId.startsWith("http"))
  ) {
    const targetUrl = screenUrlOrId.startsWith("http")
      ? screenUrlOrId
      : `https://zpl.io/${screenId}`;
    const expanded = await resolveZeplinShortlinkTarget(targetUrl, fetchFn);
    if (expanded) {
      screenId = expanded.id;
      projectId = expanded.projectId || projectId;
    }
  }

  try {
    let res = await fetchWithRateLimitRetry(
      projectId
        ? `https://api.zeplin.dev/v1/projects/${projectId}/screens/${screenId}`
        : `https://api.zeplin.dev/v1/screens/${screenId}`,
      { headers: zHeaders },
      fetchFn
    );

    if (res.status === 404 && !projectId) {
      const compRes = await fetchWithRateLimitRetry(
        `https://api.zeplin.dev/v1/components/${screenId}`,
        { headers: zHeaders },
        fetchFn
      );
      if (compRes.ok) res = compRes;
    }

    if (res.status === 401) {
      return {
        status: "AUTH_REJECTED",
        normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"),
        screenId,
        errorDescription: zeplinErrorDescription("AUTH_REJECTED"),
        note: "Zeplin authentication rejected (401 invalid token)",
      };
    }
    if (res.status === 403) {
      return {
        status: "ACCESS_DENIED",
        normalizedStatus: normalizeProviderStatus("ACCESS_DENIED"),
        screenId,
        errorDescription: zeplinErrorDescription("ACCESS_DENIED"),
        note: "Zeplin access denied (403 forbidden)",
      };
    }
    if (res.status === 404) {
      const validity = await validateCredential("zeplin", authToken, fetchFn);
      if (validity === "invalid") {
        return {
          status: "AUTH_REJECTED",
          normalizedStatus: normalizeProviderStatus("AUTH_REJECTED"),
          screenId,
          errorDescription: zeplinErrorDescription("AUTH_REJECTED"),
          note: "Zeplin authentication rejected (401 invalid token)",
        };
      }
      const projectId = parseZeplinProjectId(screenUrlOrId);
      let suggestedScreens: string[] = [];
      let projectContextNote = "";

      if (projectId) {
        try {
          const projRes = await fetchWithRateLimitRetry(
            `https://api.zeplin.dev/v1/projects/${projectId}`,
            { headers: zHeaders },
            fetchFn
          );
          if (projRes.ok) {
            const projData = (await projRes.json()) as any;
            projectContextNote = ` inside project '${projData.name}' (${projectId})`;
            const screensRes = await fetchWithRateLimitRetry(
              `https://api.zeplin.dev/v1/projects/${projectId}/screens?limit=15`,
              { headers: zHeaders },
              fetchFn
            );
            if (screensRes.ok) {
              const screens = (await screensRes.json()) as any[];
              suggestedScreens = screens.map((s: any) => `${s.name} (${s.id})`);
            }
          }
        } catch {}
      }

      if (suggestedScreens.length === 0) {
        suggestedScreens = await fetchSuggestedZeplinScreens(
          authToken,
          fetchFn
        );
      }

      const errorDescription = zeplinErrorDescription(
        "DESIGN_NOT_FOUND",
        screenId
      );
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        screenId,
        suggestedScreens: suggestedScreens.length
          ? suggestedScreens
          : undefined,
        errorDescription,
        note: suggestedScreens.length
          ? `${errorDescription}${
              projectContextNote ? ` (${projectContextNote.trim()})` : ""
            } Available screens:\n  • ${suggestedScreens.join("\n  • ")}`
          : errorDescription,
      };
    }
    if (res.status === 429) {
      return {
        status: "RATE_LIMITED",
        normalizedStatus: normalizeProviderStatus("RATE_LIMITED"),
        screenId,
        errorDescription: zeplinErrorDescription("RATE_LIMITED"),
        note: "Zeplin API rate limit exceeded (429)",
      };
    }
    if (!res.ok) {
      return {
        status: "API_UNAVAILABLE",
        normalizedStatus: normalizeProviderStatus("API_UNAVAILABLE"),
        screenId,
        errorDescription: zeplinErrorDescription("API_UNAVAILABLE"),
        note: `Zeplin API error (${res.status} ${res.statusText})`,
      };
    }

    const data = (await res.json()) as any;
    if (data.id && data.id !== screenId) {
      return {
        status: "DESIGN_NOT_FOUND",
        normalizedStatus: normalizeProviderStatus("DESIGN_NOT_FOUND"),
        screenId,
        errorDescription: "Zeplin returned a different screen than the one requested.",
      };
    }
    let specData = data;
    if (projectId) {
      const versionRes = await fetchWithRateLimitRetry(
        `https://api.zeplin.dev/v1/projects/${projectId}/screens/${screenId}/versions/latest`,
        { headers: zHeaders },
        fetchFn
      );
      if (!versionRes.ok) {
        const status: ZeplinErrorStatus = versionRes.status === 401
          ? "AUTH_REJECTED"
          : versionRes.status === 403
          ? "ACCESS_DENIED"
          : versionRes.status === 404
          ? "DESIGN_NOT_FOUND"
          : versionRes.status === 429
          ? "RATE_LIMITED"
          : "API_UNAVAILABLE";
        return {
          status,
          normalizedStatus: normalizeProviderStatus(status),
          screenId,
          errorDescription: `Cannot retrieve Zeplin screen version (${versionRes.status}).`,
        };
      }
      const version = (await versionRes.json()) as any;
      if (!Array.isArray(version?.layers)) {
        return {
          status: "API_UNAVAILABLE",
          normalizedStatus: "API_UNAVAILABLE",
          screenId,
          errorDescription: "Zeplin screen version has no layers array.",
        };
      }
      specData = { ...data, ...version, id: data.id, name: data.name };
    }
    const screen = extractScreen(specData, screenId);
    const extract = extractDetails(specData, screen);

    const visual = outputDir && (!projectId || specData.image_url)
      ? await renderZeplinScreen(
          screenId,
          authToken,
          outputDir,
          screen,
          extract,
          fetchFn,
          projectId ? specData.image_url : undefined
        )
      : {};
    const assetData = await downloadZeplinAssets(
      screenId,
      outputDir,
      zHeaders,
      fetchFn,
      projectId ? specData.assets || [] : undefined
    );

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
