import fs from "node:fs/promises";

export async function validateFfmpegOutput(run, probe, output, { width, height, frameCount, audio }) {
  const result = JSON.parse(await run(probe, ["-v", "error", "-select_streams", "v:0", "-count_frames", "-show_entries", "stream=width,height,nb_read_frames", "-of", "json", output]));
  const stream = result.streams?.[0];
  if (stream?.width !== width || stream?.height !== height || Number(stream.nb_read_frames) !== frameCount) {
    throw new Error("FFmpeg output did not contain the expected dimensions and frame count.");
  }
  if (audio) {
    const audioResult = JSON.parse(await run(probe, ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "json", output]));
    if (audioResult.streams?.[0]?.codec_type !== "audio") {
      throw new Error("FFmpeg output did not contain the expected audio stream.");
    }
  }
}

export async function publishFfmpegOutput(run, probe, temporaryOutput, output, options) {
  await validateFfmpegOutput(run, probe, temporaryOutput, options);
  await fs.rename(temporaryOutput, output);
}
