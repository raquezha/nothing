import fs from "node:fs/promises";
import path from "node:path";

export async function validateFrames(framesDir, frameCount) {
  for (let index = 0; index < frameCount; index++) {
    const frame = path.join(framesDir, `frame_${String(index).padStart(6, "0")}.png`);
    let stat;
    try {
      stat = await fs.stat(frame);
    } catch {
      throw new Error(`Missing frame ${index}: ${frame}`);
    }
    if (!stat.isFile() || stat.size === 0) throw new Error(`Invalid frame ${index}: ${frame}`);
  }
}
