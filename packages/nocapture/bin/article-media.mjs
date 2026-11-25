#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "nocapture.mjs");
const result = spawnSync(process.execPath, [target, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(result.status ?? 1);
