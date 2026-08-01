// Encode a captured scene straight to mp4 with ffmpeg, from the same
// manifest.json the Remotion compositor reads.
//
//   node rig/encode.mjs --scene recipe-preview
//
// This is the no-frills path: frames + audio placed at their manifest offsets,
// supersampled 2x -> 1080p. It deliberately does NOT do captions, zooms or the
// synthetic playhead -- that is what remotion/ is for. Its job is to prove the
// manifest is sufficient to reconstruct the video, and to give a rendered file
// without a Remotion toolchain.

import { readFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { parseArgs } from './run-scene.mjs';

const DEMO = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function buildArgs(m, outDir, outFile, { width }) {
  const framesGlob = join(outDir, m.framePattern);
  const args = ['-y', '-framerate', String(m.fps), '-i', framesGlob];

  for (const a of m.audio) args.push('-i', join(outDir, a.file));

  const filters = [];
  // Supersample 2x captures down to the delivery size. lanczos keeps the 1px
  // cables and small type crisp where bilinear would smear them.
  filters.push(`[0:v]scale=${width}:-2:flags=lanczos,format=yuv420p[v]`);

  const seconds = m.durationFrames / m.fps;

  if (m.audio.length) {
    // adelay places each render at its manifest frame. This is the same
    // arithmetic the compositor does: t = startFrame / fps.
    m.audio.forEach((a, i) => {
      const ms = Math.round((a.startFrame / m.fps) * 1000);
      filters.push(`[${i + 1}:a]adelay=${ms}:all=1[a${i}]`);
    });
    const inputs = m.audio.map((_, i) => `[a${i}]`).join('');
    const mixed = m.audio.length > 1
      ? `${inputs}amix=inputs=${m.audio.length}:normalize=0`
      : `${inputs}anull`;
    // apad then atrim pins the audio track to exactly the capture's length:
    // a render that ends before the last frame must not shorten the video, and
    // one that would overrun it must not lengthen it.
    filters.push(`${mixed},apad,atrim=0:${seconds.toFixed(6)},asetpts=N/SR/TB[a]`);
  }

  args.push('-filter_complex', filters.join(';'), '-map', '[v]');
  if (m.audio.length) args.push('-map', '[a]', '-c:a', 'aac', '-b:a', '256k');

  args.push(
    '-c:v', 'libx264', '-crf', '16', '-preset', 'slow',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    // durationFrames is authoritative. Never -shortest: audio that ends early
    // would silently truncate the video (and drop the scene's closing hold).
    '-frames:v', String(m.durationFrames),
    outFile,
  );
  return args;
}

export async function encode({ scene, width = 1920, outFile } = {}) {
  const outDir = join(DEMO, 'out', scene);
  const manifestPath = join(outDir, 'manifest.json');
  if (!existsSync(manifestPath)) throw new Error(`no manifest at ${manifestPath} -- capture the scene first`);
  const m = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const target = outFile ?? join(outDir, 'video.mp4');
  const args = buildArgs(m, outDir, target, { width });

  await new Promise((ok, fail) => {
    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error(`ffmpeg exited ${c}\n${err.slice(-1500)}`))));
  });

  return { outFile: target, manifest: m };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs();
  const scene = args.scene ?? 'recipe-preview';
  const r = await encode({ scene, width: Number(args.width ?? 1920) });
  console.log(`[encode] ${scene}: ${r.manifest.durationFrames} frames @${r.manifest.fps}fps, ` +
              `${r.manifest.audio.length} audio clip(s) -> ${r.outFile}`);
}
