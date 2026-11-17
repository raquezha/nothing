import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(__dirname, "..");
const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgRoot, "package.json"), "utf8"));

// 1. Verify package.json exports both skills for Pi and npm packaging
assert.ok(Array.isArray(pkgJson.files), "package.json must have a files array");
assert.ok(pkgJson.files.includes("figma-standard"), "package.json files must include figma-standard");
assert.ok(pkgJson.files.includes("nodesign-ui"), "package.json files must include nodesign-ui");
assert.deepEqual(
  pkgJson.pi?.skills,
  ["figma-standard", "nodesign-ui"],
  "package.json pi.skills must register figma-standard and nodesign-ui"
);

// 2. Verify skill files, frontmatter, references, and public codename hygiene
const expectedSkills = [
  {
    name: "figma-standard",
    dir: path.join(pkgRoot, "figma-standard"),
    refs: ["references/nodesign-token-grammar.md", "references/local-figma-hacks.md"],
  },
  {
    name: "nodesign-ui",
    dir: path.join(pkgRoot, "nodesign-ui"),
    refs: ["references/stack-adapters.md"],
  },
];

for (const skill of expectedSkills) {
  const skillMdPath = path.join(skill.dir, "SKILL.md");
  assert.ok(fs.existsSync(skillMdPath), `Missing ${skillMdPath}`);
  const content = fs.readFileSync(skillMdPath, "utf8");
  assert.match(content, new RegExp(`^---\\nname: ${skill.name}\\ndescription: .+\\n---`, "m"));
  assert.ok(!/nueca/i.test(content), `${skill.name}/SKILL.md must use public NoDesign codename`);

  for (const ref of skill.refs) {
    const refPath = path.join(skill.dir, ref);
    assert.ok(fs.existsSync(refPath), `Missing reference ${refPath}`);
    const refContent = fs.readFileSync(refPath, "utf8");
    assert.ok(!/nueca/i.test(refContent), `${ref} must use public NoDesign codename`);
  }
}

// 3. Validate NoDesign DTCG 4-collection grammar rules
const SEGMENT_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateNoDesignTokenTree(node, pathSegments = []) {
  for (const [key, val] of Object.entries(node)) {
    if (key.startsWith("$")) continue;
    assert.match(key, SEGMENT_RE, `Token segment "${key}" at ${pathSegments.join(".")} violates kebab-case grammar`);
    const nextPath = [...pathSegments, key];
    if (val && typeof val === "object" && "$value" in val) {
      const ext = val.$extensions?.["com.nodesign"];
      assert.ok(ext, `Token ${nextPath.join(".")} missing $extensions["com.nodesign"]`);
      if (ext.collection === "Tokens: Primitive") {
        assert.deepEqual(ext.scopes, [], `Primitive token ${nextPath.join(".")} must have empty scopes []`);
      } else if (ext.collection === "Color: Semantic") {
        assert.match(val.$value, /^\{colors\..+\}$/, `Semantic color ${nextPath.join(".")} must alias a primitive`);
        assert.ok(val.$description, `Semantic token ${nextPath.join(".")} must include $description`);
        assert.ok(ext.codeSyntax?.WEB && ext.codeSyntax?.ANDROID && ext.codeSyntax?.iOS, `Semantic token ${nextPath.join(".")} must define WEB/ANDROID/iOS codeSyntax`);
      } else if (ext.collection === "Breakpoints: Semantic" && nextPath.join(".") !== "layout.columns.columns") {
        assert.match(val.$value, /^\{pixels\..+\}$/, `Semantic dimension ${nextPath.join(".")} must alias {pixels.*}`);
      }
    } else if (val && typeof val === "object") {
      validateNoDesignTokenTree(val, nextPath);
    }
  }
}

const sampleSiteTokens = "/Users/raquezha/RQZ/personal/site/tokens/raquezha-net.tokens.json";
if (fs.existsSync(sampleSiteTokens)) {
  const tokenTree = JSON.parse(fs.readFileSync(sampleSiteTokens, "utf8"));
  validateNoDesignTokenTree(tokenTree);
}

console.log("nodesign skills test ok");
