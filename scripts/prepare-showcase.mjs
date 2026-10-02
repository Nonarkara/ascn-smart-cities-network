import { spawnSync } from "node:child_process";
import { mkdir, stat, writeFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../media/showcase/", import.meta.url));
const desktop = process.env.ASCN_VIDEO_SOURCE_DIR || join(homedir(), "Desktop");
const clips = [
  { id: "flood-field", source: "VID-20260927-WA0006.mp4", bitrate: "260k", posterTime: 18 },
  { id: "city-operations", source: "VID_20260929_163012_897.mp4", bitrate: "360k", posterTime: 75 },
  { id: "flood-analysis", source: "2_5325870699577911300.mp4", bitrate: "360k", posterTime: 90 },
];

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
  return result.stdout;
}

await mkdir(output, { recursive: true });
const metadata = [];
for (const clip of clips) {
  const input = join(desktop, clip.source);
  const video = join(output, `${clip.id}.mp4`);
  const passlog = join(tmpdir(), `ascn-${clip.id}-${process.pid}`);
  const common = ["-hide_banner", "-loglevel", "error", "-y", "-i", input,
    "-map", "0:v:0", "-vf", "scale=w='min(1280,iw)':h=-2", "-c:v", "libx264",
    "-preset", "fast", "-b:v", clip.bitrate, "-pix_fmt", "yuv420p", "-passlogfile", passlog];
  console.log(`Preparing ${clip.source}`);
  try {
    // Two passes keep the complete long recordings below Pages' per-file limit.
    run("ffmpeg", [...common, "-pass", "1", "-an", "-f", "null", "/dev/null"]);
    run("ffmpeg", [...common, "-pass", "2", "-map", "0:a:0?", "-c:a", "aac", "-b:a", "48k",
      "-movflags", "+faststart", "-map_metadata", "-1", video]);
  } finally {
    await rm(`${passlog}-0.log`, { force: true });
    await rm(`${passlog}-0.log.mbtree`, { force: true });
  }
  run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", String(clip.posterTime),
    "-i", input, "-frames:v", "1", "-vf", "scale=w='min(1280,iw)':h=-2", "-q:v", "3",
    join(output, `${clip.id}.jpg`)]);
  const probe = JSON.parse(run("ffprobe", ["-v", "quiet", "-show_format", "-show_streams", "-of", "json", video]));
  const bytes = (await stat(video)).size;
  if (bytes >= 25 * 1024 * 1024) throw new Error(`${clip.id} exceeds the Pages 25 MiB asset limit`);
  metadata.push({ id: clip.id, original: clip.source, originalBytes: (await stat(input)).size,
    bytes, duration: Number(probe.format.duration), width: probe.streams[0].width,
    height: probe.streams[0].height, videoCodec: probe.streams[0].codec_name,
    audioCodec: probe.streams.find((stream) => stream.codec_type === "audio")?.codec_name });
  console.log(`${clip.id}: ${(bytes / 1024 / 1024).toFixed(1)} MiB`);
}
await writeFile(join(output, "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`);
