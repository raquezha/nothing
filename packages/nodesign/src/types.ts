/** Evidence status for design assets. */
export type EvidenceStatus = "missing" | "ambiguous" | "ready";

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
  /** Human-readable notes about what is missing or ambiguous. */
  notes: string[];
}

/** Full design brief emitted by nodesign. */
export interface DesignBrief {
  taskId: string;
  timestamp: string;
  preflight: PreflightResult;
}
