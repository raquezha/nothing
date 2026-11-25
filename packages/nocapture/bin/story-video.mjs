#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const mapped = args[0] === "render" ? ["video", ...args.slice(1)] : args;
const target = path.join(path.dirname(fileURLToPath(import.meta.url)), "article-media.mjs");
const result = spawnSync(process.execPath, [target, ...mapped], { stdio: "inherit" });
process.exit(result.status ?? 1);
