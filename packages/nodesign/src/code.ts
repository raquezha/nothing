import type { UnifiedNode, ProjectCodeContext } from "./generators/compose.js";
import { nodeToCompose } from "./generators/compose.js";
import { nodeToReact, nodeToHtml } from "./generators/web.js";

export type { UnifiedNode, ProjectCodeContext };

export function generateCodeSnippet(
  nodes: UnifiedNode[],
  target: "compose" | "react" | "html",
  screenName = "GeneratedScreen",
  context?: ProjectCodeContext,
): string {
  if (!nodes || nodes.length === 0) return "// No hierarchy nodes available for code generation";

  let cleanName = screenName.replace(/[^a-zA-Z0-9]/g, "");
  if (!cleanName || /^[0-9]/.test(cleanName)) {
    cleanName = `Screen${cleanName}`;
  }

  switch (target) {
    case "compose": {
      const baseImports = [
        "import androidx.compose.foundation.background",
        "import androidx.compose.foundation.layout.*",
        "import androidx.compose.material3.Text",
        "import androidx.compose.runtime.Composable",
        "import androidx.compose.ui.Alignment",
        "import androidx.compose.ui.Modifier",
        "import androidx.compose.ui.graphics.Color",
        "import androidx.compose.ui.text.font.FontWeight",
        "import androidx.compose.ui.unit.dp",
        "import androidx.compose.ui.unit.sp",
      ];

      const customImports = new Set<string>();
      if (context?.colorTokens) {
        for (const ct of context.colorTokens) {
          if (ct.importStatement) customImports.add(ct.importStatement);
        }
      }

      const allImports = [...baseImports, ...Array.from(customImports)].sort().join("\n");
      const archHeader = context?.architectureType
        ? `// Architecture Structure: ${context.architectureType}\n`
        : "";
      const body = nodes.map((n) => nodeToCompose(n, 1, context, cleanName)).join("\n\n");
      return `${archHeader}${allImports}\n\n@Composable\nfun ${cleanName}() {\n${body}\n}`;
    }

    case "react": {
      const body = nodes.map((n) => nodeToReact(n, 2)).join("\n\n");
      return `export function ${cleanName}() {\n  return (\n${body}\n  );\n}`;
    }

    case "html": {
      const body = nodes.map((n) => nodeToHtml(n, 1)).join("\n\n");
      return `<!-- Design Spec HTML -->\n<div class="${cleanName.toLowerCase()}">\n${body}\n</div>`;
    }
  }
}
