export type {
  EvidenceStatus,
  ProviderStatus,
  AndroidUIStack,
  DesignLink,
  ComponentFact,
  AndroidInspection,
  PreflightResult,
  DesignBrief,
  VisualAnalysis,
  UiPropertyType,
  UiPropertyStatus,
  UiPropertyInput,
  UiPropertyComparison,
  PropertyVerificationResult,
} from "./types.js";

export type {
  ZeplinErrorStatus,
  ZeplinColorSpec,
  ZeplinScreenSpec,
  ZeplinAssetSpec,
  ZeplinResolutionResult,
} from "./zeplin.js";

export type {
  FigmaErrorStatus,
  FigmaResolutionResult,
} from "./figma.js";

export { inspectAndroidProject, detectAndroidUIStack, scanUiComponents } from "./android.js";
export { formatDesignBrief, formatTreeBlueprint, formatAgentDirective, parseDesignLink, determineEvidenceStatus } from "./brief.js";
export { extractDesignLinksFromText, inspectJiraTaskText, inspectJiraContext } from "./jira.js";
export { resolveZeplinScreen, parseZeplinScreenId, resolveZeplinShortlink, rgbToHex } from "./zeplin.js";
export { resolveFigmaLink, parseFigmaUrl } from "./figma.js";
export { resolveCredential, resolveCredentials, storeCredential, validateCredential, validateCredentialWithInfo, deleteCredential } from "./auth.js";
export { checkUpdateNotice } from "./update.js";
export { renderDesignNode, type RenderOptions, type RenderResult } from "./render.js";

export { generateCodeSnippet } from "./code.js";
export { matchComponent, normalizeComponentName, type ComponentMatchResult } from "./matcher.js";
export { generateGroundingManifest, formatGroundingManifestMarkdown, type GroundingManifest, type MatchedDesignToken, type ProjectGroundingContext } from "./manifest.js";
export {
  compareUiProperty,
  verifyUiProperties,
  verifyUiFidelity,
  formatPropertyVerification,
  normalizePropertyValue,
  type UiFidelityReport,
} from "./properties.js";

export { run } from "./cli.js";
