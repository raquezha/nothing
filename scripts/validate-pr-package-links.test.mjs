import assert from "node:assert/strict";
import { test } from "node:test";
import { hasPackageChanges, issueRefs, validatePrPackageLinks } from "./validate-pr-package-links.mjs";

test("hasPackageChanges covers workspace packages and workflow packages", () => {
  assert.equal(hasPackageChanges(["packages/noheadroom/package.json"]), true);
  assert.equal(hasPackageChanges(["packages/workflows/nochestra/README.md"]), true);
  assert.equal(hasPackageChanges(["docs/workflow.md"]), false);
});

test("validatePrPackageLinks rejects missing changeset refs for workflow package changes", () => {
  const result = validatePrPackageLinks({
    files: ["packages/workflows/nochestra/delivery-command.mjs", ".changeset/test.md"],
    body: "Refs #143",
    readChangeset: () => "no issue ref here",
    fileExists: () => true,
  });

  assert.equal(result.ok, false);
  assert.match(result.lines[2], /#143/);
});

test("validatePrPackageLinks accepts matching changeset refs", () => {
  const result = validatePrPackageLinks({
    files: ["packages/workflows/nochestra/delivery-command.mjs", ".changeset/test.md"],
    body: "Refs #143",
    readChangeset: () => "Refs #143",
    fileExists: () => true,
  });

  assert.deepEqual(result, { ok: true });
});

test("issueRefs extracts unique refs only", () => {
  assert.deepEqual(issueRefs("Refs #1 Refs #1 Refs #2"), ["1", "2"]);
});
