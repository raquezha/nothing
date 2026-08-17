export type {
  EvidenceStatus,
  AndroidUIStack,
  DesignLink,
  ComponentFact,
  AndroidInspection,
  PreflightResult,
  DesignBrief,
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
export { formatDesignBrief, parseDesignLink, determineEvidenceStatus } from "./brief.js";
export { extractDesignLinksFromText, inspectJiraTaskText, inspectJiraContext } from "./jira.js";
export { resolveZeplinScreen, parseZeplinScreenId, rgbToHex } from "./zeplin.js";
export { resolveFigmaLink, parseFigmaUrl } from "./figma.js";
export { resolveCredentials, storeCredential } from "./auth.js";
export {
  compareUiProperty,
  verifyUiProperties,
  normalizePropertyValue,
} from "./properties.js";
export { run } from "./cli.js";
