import type { AndroidUIStack, ArchitectureType } from "../types.js";

export interface StackGuideline {
  stack: AndroidUIStack;
  targetPackageLocation: string;
  allowedImports: string[];
  forbiddenImports: string[];
  resourceStrategy: string;
  themingRule: string;
}

export function getStackGuideline(
  stack: AndroidUIStack,
  architectureType: ArchitectureType = "CLEAN_ARCHITECTURE",
): StackGuideline {
  switch (stack) {
    case "kmp":
      return {
        stack: "kmp",
        targetPackageLocation: "commonMain/kotlin/... (UI layer)",
        allowedImports: [
          "androidx.compose.runtime.*",
          "androidx.compose.foundation.*",
          "androidx.compose.material3.*",
          "org.jetbrains.compose.resources.*",
        ],
        forbiddenImports: [
          "android.*",
          "androidx.compose.ui.platform.LocalContext",
          "android.widget.*",
        ],
        resourceStrategy: "Use Compose Multiplatform Res.drawable.* and Res.string.*. Do NOT use Android R.*",
        themingRule: "Use shared MaterialTheme tokens or CMP Theme wrapper in commonMain.",
      };

    case "compose":
      return {
        stack: "compose",
        targetPackageLocation: architectureType === "CLEAN_ARCHITECTURE"
          ? "presentation/ or ui/screens/ package"
          : "ui/screens/ or feature/*/ui/",
        allowedImports: [
          "androidx.compose.runtime.*",
          "androidx.compose.foundation.*",
          "androidx.compose.material3.*",
          "androidx.compose.ui.Modifier",
        ],
        forbiddenImports: [
          "android.view.View",
          "android.widget.*",
        ],
        resourceStrategy: "Use painterResource(R.drawable.*) or Icons.Default.*",
        themingRule: "Use MaterialTheme.colorScheme or project-level design tokens (e.g. TapatColors).",
      };

    case "views":
      return {
        stack: "views",
        targetPackageLocation: "res/layout/ (XML layouts) and ui/ (Activity/Fragment)",
        allowedImports: [
          "android.view.View",
          "androidx.appcompat.app.*",
          "androidx.constraintlayout.widget.ConstraintLayout",
        ],
        forbiddenImports: [
          "androidx.compose.*",
        ],
        resourceStrategy: "Use @color/*, @dimen/*, and @drawable/* in XML layouts.",
        themingRule: "Use styles.xml / themes.xml attributes (?attr/colorPrimary).",
      };

    case "mixed":
      return {
        stack: "mixed",
        targetPackageLocation: "New screens in Compose; embed via ComposeView in XML fragments if needed.",
        allowedImports: [
          "androidx.compose.runtime.*",
          "androidx.compose.ui.platform.ComposeView",
        ],
        forbiddenImports: [],
        resourceStrategy: "Use R.drawable.* / painterResource(R.drawable.*).",
        themingRule: "Wrap Compose screens in the project's Compose Theme wrapper.",
      };

    default:
      return {
        stack: "n/a",
        targetPackageLocation: "Appropriate UI directory for project platform.",
        allowedImports: [],
        forbiddenImports: [],
        resourceStrategy: "Use platform standard asset resolution.",
        themingRule: "Use platform CSS/design tokens.",
      };
  }
}
