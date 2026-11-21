#!/usr/bin/env node

const usage = `Usage:
  story-video render --scene <file> --duration <seconds> --fps <frames-per-second> \\
    --width <pixels> --height <pixels> --output <file> [--preview]

The render backend is introduced in the next implementation slice.`;

if (process.argv.length === 2 || process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(usage);
  process.exit(0);
}

console.error(usage);
process.exit(1);
