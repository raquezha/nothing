import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { detectAndroidUIStack, inspectAndroidProject } from "../dist/android.js";

function makeProject(name, files) {
  const root = mkdtempSync(path.join(tmpdir(), `nodesign-${name}-`));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, rel);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  return root;
}

function cleanup(paths) {
  for (const p of paths) rmSync(p, { recursive: true, force: true });
}

const roots = [];

try {
  const compose = makeProject("compose", {
    "app/build.gradle.kts": 'dependencies { implementation("androidx.compose.ui:ui:1.0.0") }',
    "ui/components/PrimaryButton.kt": "@Composable fun PrimaryButton() {}",
    "ui/components/notes.txt": "ignore me",
  });
  roots.push(compose);
  assert.equal(detectAndroidUIStack(compose), "compose");
  const composeInspection = inspectAndroidProject(compose);
  assert.equal(composeInspection.components[0].name, "PrimaryButton");
  assert.equal(composeInspection.components.length, 1);

  const views = makeProject("views", {
    "app/src/main/res/layout-land/activity_main.xml": "<LinearLayout />",
  });
  roots.push(views);
  assert.equal(detectAndroidUIStack(views), "views");

  const mixed = makeProject("mixed", {
    "app/build.gradle": "buildFeatures { compose true }",
    "app/src/main/res/layout/activity_main.xml": "<LinearLayout />",
  });
  roots.push(mixed);
  assert.equal(detectAndroidUIStack(mixed), "mixed");

  const kmp = makeProject("kmp", {
    "shared/build.gradle.kts": 'plugins { id("org.jetbrains.compose") }',
    "shared/src/commonMain/kotlin/App.kt": "@Composable fun App() = Unit",
    "shared/src/commonMain/composeResources/values/strings.xml": "<resources />",
  });
  roots.push(kmp);
  assert.equal(detectAndroidUIStack(kmp), "kmp");

  const ambiguous = makeProject("ambiguous", {
    "app/build.gradle.kts": "plugins { id(\"com.android.application\") }",
  });
  roots.push(ambiguous);
  assert.equal(detectAndroidUIStack(ambiguous), "ambiguous");

  const plainKmp = makeProject("plain-kmp", {
    "shared/src/commonMain/kotlin/Domain.kt": "class Domain",
  });
  roots.push(plainKmp);
  assert.equal(detectAndroidUIStack(plainKmp), "n/a");

  const plainJvmGradle = makeProject("plain-jvm-gradle", {
    "build.gradle.kts": 'plugins { kotlin("jvm") version "2.0.0" }',
  });
  roots.push(plainJvmGradle);
  assert.equal(detectAndroidUIStack(plainJvmGradle), "n/a");

  const generated = makeProject("generated", {
    "build/intermediates/merged_manifest/debug/AndroidManifest.xml": "<manifest />",
    ".gradle/cache/build.gradle.kts": 'plugins { id("com.android.application") }',
  });
  roots.push(generated);
  assert.equal(detectAndroidUIStack(generated), "n/a");

  const nonUi = makeProject("non-ui", {
    "README.md": "hello",
  });
  roots.push(nonUi);
  const inspected = inspectAndroidProject(nonUi);
  assert.equal(inspected.androidUIStack, "n/a");
  assert.equal(inspected.components.length, 0);

  console.log("nodesign android test ok");
} finally {
  cleanup(roots);
}
