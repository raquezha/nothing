import type { AndroidUIStack, ArchitectureType } from "../types.js";
import { getStackGuideline } from "./guidelines.js";

export function buildStackAwareDirective(
  screenName = "Target UI",
  stack: AndroidUIStack = "compose",
  architectureType: ArchitectureType = "CLEAN_ARCHITECTURE",
  archDetails = "Konsist-style code pattern scanner",
): string {
  const guide = getStackGuideline(stack, architectureType);

  const lines: string[] = [
    "================================================================================",
    "STRICT AI AGENT DIRECTIVE — ZERO-DRIFT UI IMPLEMENTATION CONTRACT",
    "================================================================================",
    `Target UI: '${screenName}'`,
    `Detected UI Stack: ${stack.toUpperCase()} (Target: ${guide.targetPackageLocation})`,
    `Project Architecture: ${architectureType} (${archDetails})`,
    `Resource Strategy: ${guide.resourceStrategy}`,
    `Theming Rule: ${guide.themingRule}`,
    "",
    "Follow these 5 non-negotiable rules:",
    "",
    "1. MANDATORY BLUEPRINT ADHERENCE:",
    "   - Build the exact component tree structure specified in the UI Blueprint below.",
    "   - Do NOT alter container ordering, layout direction (ROW/COLUMN), or node nesting.",
    "",
    "2. REUSE DISCOVERED COMPONENTS & THEME TOKENS:",
    "   - MUST reuse discovered project components wherever mapped in the manifest.",
    "   - MUST use discovered theme tokens instead of raw hex values (e.g. Color(0xFF...)).",
    "   - Do NOT invent duplicate components when theme tokens or reusable components exist.",
    "",
    "3. PLATFORM & STACK COMPLIANCE:",
  ];

  if (stack === "kmp") {
    lines.push(
      "   - STRICT CMP RULE: Code must live in `commonMain`. NEVER import `android.*` or `LocalContext`.",
      "   - Use `Res.drawable.*` and `Res.string.*` for multiplatform assets.",
    );
  } else if (stack === "views") {
    lines.push(
      "   - NATIVE XML RULE: Build UI using XML layouts under `res/layout/`. Do NOT write @Composable.",
      "   - Reference tokens via `@color/...` and dimension resources via `@dimen/...`.",
    );
  } else if (stack === "mixed") {
    lines.push(
      "   - HYBRID RULE: Build new UI in Compose. Use ComposeView for legacy XML fragment integration.",
    );
  } else {
    lines.push(
      "   - COMPOSE RULE: Build standard Jetpack Compose Composables with Material 3 tokens.",
      "   - Root full-width containers MUST use `Modifier.fillMaxWidth()`, not hardcoded width sizes.",
    );
  }

  lines.push(
    "",
    "4. ZERO DRIFT GUARANTEE:",
    "   - Do NOT add unrequested cards, extra wrappers, or random decorative elements.",
    "   - Match all specified padding, spacing/gap, fonts, and dimensions 1:1.",
    "",
    "5. CODE INTEGRITY:",
    "   - Ensure the generated code compiles cleanly with all required package imports.",
    "================================================================================",
  );

  return lines.join("\n");
}
