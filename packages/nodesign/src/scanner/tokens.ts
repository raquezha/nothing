import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { walk } from "./components.js";

export interface ColorTokenFact {
  hex: string;
  token: string;
  sourceFile: string;
  packageName?: string;
  importStatement?: string;
}

function readText(filePath: string): string {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

export function scanColorTokens(rootPath: string, files?: string[]): ColorTokenFact[] {
  const fileList = files || walk(rootPath);
  const colorFacts: ColorTokenFact[] = [];
  const seen = new Set<string>();

  const configPath = path.join(rootPath, ".nodesign.json");
  if (existsSync(configPath)) {
    try {
      const cfg = JSON.parse(readFileSync(configPath, "utf8"));
      if (Array.isArray(cfg?.colorTokens)) {
        for (const ct of cfg.colorTokens) {
          if (ct.hex && ct.token) {
            const hexKey = ct.hex.startsWith("#") ? ct.hex.toUpperCase() : `#${ct.hex.toUpperCase()}`;
            seen.add(hexKey);
            colorFacts.push({
              hex: hexKey,
              token: ct.token,
              sourceFile: ct.sourceFile || ".nodesign.json",
              importStatement: ct.importStatement,
            });
          }
        }
      }
    } catch {}
  }

  function addFact(hexRaw: string, token: string, file: string, pkg?: string) {
    let cleanHex = hexRaw.toUpperCase().trim();
    if (cleanHex.length === 4 && cleanHex.startsWith("#")) {
      cleanHex = `#${cleanHex[1]}${cleanHex[1]}${cleanHex[2]}${cleanHex[2]}${cleanHex[3]}${cleanHex[3]}`;
    }
    const hexKey = cleanHex.startsWith("#") ? cleanHex : `#${cleanHex}`;
    if (!seen.has(hexKey)) {
      seen.add(hexKey);
      const relFile = path.relative(rootPath, file);
      const importStatement = pkg && !token.startsWith("colorResource")
        ? `import ${pkg}.${token.split(".")[0]}`
        : undefined;

      colorFacts.push({
        hex: hexKey,
        token,
        sourceFile: relFile,
        packageName: pkg,
        importStatement,
      });
    }
  }

  for (const file of fileList) {
    if (file.endsWith("colors.xml") || file.endsWith("values/colors.xml")) {
      const text = readText(file);
      const matches = text.matchAll(/<color\s+name=["']([^"']+)["']\s*>([^<]+)<\/color>/gi);
      for (const m of matches) {
        const name = m[1];
        const rawVal = m[2].trim().toUpperCase();
        if (/^#([0-9A-F]{3}|[0-9A-F]{6}|[0-9A-F]{8})$/i.test(rawVal)) {
          addFact(rawVal, `colorResource(R.color.${name})`, file);
        }
      }
    }

    const isThemeFile = file.endsWith(".kt") && (
      file.includes(`${path.sep}theme${path.sep}`) ||
      file.includes(`${path.sep}ui${path.sep}`) ||
      file.includes(`${path.sep}designsystem${path.sep}`) ||
      file.includes(`${path.sep}commonMain${path.sep}`) ||
      /Theme|Color|Design/i.test(path.basename(file))
    );

    if (isThemeFile) {
      const text = readText(file);
      const pkgMatch = text.match(/^package\s+([a-zA-Z0-9_.]+)/m);
      const packageName = pkgMatch ? pkgMatch[1] : undefined;

      const objMatch = text.match(/object\s+([a-zA-Z0-9_]+Theme|[a-zA-Z0-9_]+Colors|[a-zA-Z0-9_]+DesignSystem)/);
      const themeObject = objMatch ? objMatch[1] : undefined;

      const matches = text.matchAll(/val\s+([a-zA-Z0-9_]+)(?:\s*:\s*Color)?\s*=\s*Color\(\s*0x([0-9a-fA-F]+)\s*\)/g);
      for (const m of matches) {
        const propName = m[1];
        let hexVal = m[2].toUpperCase();
        if (hexVal.length === 8 && hexVal.startsWith("FF")) hexVal = hexVal.slice(2);
        const hex = `#${hexVal}`;
        const token = themeObject ? `${themeObject}.${propName}` : propName;
        addFact(hex, token, file, packageName);
      }
    }
  }

  return colorFacts;
}
