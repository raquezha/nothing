import type { ZeplinResolutionResult } from "./zeplin.js";
import type { FigmaResolutionResult } from "./figma.js";

/** Evidence status for design assets. */
export type EvidenceStatus = "missing" | "ambiguous" | "ready";
export type ProviderStatus = "SUCCESS" | "AUTH_REQUIRED" | "TOKEN_INVALID" | "FILE_FORBIDDEN" | "NODE_NOT_FOUND" | "RATE_LIMITED" | "API_UNAVAILABLE" | "AMBIGUOUS_URL";

/** Detected Android/KMP UI stack. */
export type AndroidUIStack =
  | "compose"
  | "views"
  | "mixed"
  | "kmp"
  | "ambiguous"
  | "n/a";

/** A link to a design source (Zeplin screen, Figma frame, etc.). */
export interface DesignLink {
  provider: "zeplin" | "figma" | "other";
  url: string;
  label?: string;
}

/** Existing reusable UI component discovered in the repo. */
export interface ComponentFact {
  name: string;
  path: string;
}

/** Android/KMP inspection result. */
export interface AndroidInspection {
  androidUIStack: AndroidUIStack;
  components: ComponentFact[];
  notes: string[];
}

/** Normalized preflight result from a nodesign run. */
export interface PreflightResult {
  /** Is this task UI-sensitive? */
  uiSensitive: boolean;
  /** Detected Android UI stack (or n/a for non-Android). */
  androidUIStack: AndroidUIStack;
  /** Design evidence status. */
  evidenceStatus: EvidenceStatus;
  /** Direct links to design screens/frames. */
  designLinks: DesignLink[];
  /** Zeplin screen resolutions collected during preflight. */
  resolvedScreens?: ZeplinResolutionResult[];
  /** Figma link resolutions collected during preflight. */
  resolvedFigma?: FigmaResolutionResult[];
  /** Existing reusable UI components discovered in the repo. */
  components: ComponentFact[];
  /** Human-readable notes about what is missing or ambiguous. */
  notes: string[];
}

/** Supported Android UI property types for design evidence comparison. */
export type UiPropertyType =
  | "iconWidth"
  | "iconHeight"
  | "iconColor"
  | "textSize"
  | "fontFamily"
  | "fontWeight"
  | "textColor"
  | "backgroundColor"
  | "padding"
  | "margin"
  | "spacing"
  | "dimensions"
  | "cornerRadius"
  | "stroke"
  | "opacity";

/** Verification result status for a single UI property. */
export type UiPropertyStatus =
  | "MATCH"
  | "MISMATCH"
  | "UNKNOWN"
  | "EXPLICITLY_WAIVED";

/** Input specification for a UI property comparison. */
export interface UiPropertyInput {
  property: UiPropertyType;
  expected: string;
  actual?: string;
  /** Resolved concrete value of expected token (e.g. #6200EE). */
  resolvedExpected?: string;
  /** Resolved concrete value of actual token (e.g. #000000). */
  resolvedActual?: string;
  /** Style or theme token name if used (e.g. MaterialTheme.colorScheme.primary). */
  tokenName?: string;
  /** Actual style or theme token name used in implementation if different. */
  actualTokenName?: string;
  /** Optional waiver flag or reason. */
  waived?: boolean | string;
}

/** Result of comparing a single UI property. */
export interface UiPropertyComparison {
  property: UiPropertyType;
  expected: string;
  actual?: string;
  resolvedExpected: string;
  resolvedActual?: string;
  status: UiPropertyStatus;
  tokenName?: string;
  actualTokenName?: string;
  waiverReason?: string;
  notes?: string;
}

/** Result summary of exact Android UI property verification. */
export interface PropertyVerificationResult {
  exactFidelityRequired: boolean;
  passed: boolean;
  comparisons: UiPropertyComparison[];
  summary: {
    match: number;
    mismatch: number;
    unknown: number;
    waived: number;
  };
}

/** Full design brief emitted by nodesign. */
export interface DesignBrief {
  taskId: string;
  timestamp: string;
  preflight: PreflightResult;
}
