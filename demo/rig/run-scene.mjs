// Wires the rig together and runs a scene module.
//
//   node rig/run-scene.mjs --scene recipe-preview --recipe "Gritty saw"
//
// A scene exports { name?, default: async (a, ctx) => void } where `a` is the
// verb API from actions.mjs.

import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { startServer, launch } from './browser.mjs';
import { createClock } from './clock.mjs';
import { createCapture } from './capture.mjs';
import { createManifest } from './manifest.mjs';
import { createActions } from './actions.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEMO = resolve(HERE, '..');

export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    out[k] = v;
  }
  return out;
}

export async function runScene({
  scene, sceneArgs = {}, out, fps = 30, width = 1920, height = 1080, scale = 2,
  headless = true, mode = 'lockstep', port = 8123, server = null, browser = null,
  cursor = {},
}) {
  const outDir = out ?? join(DEMO, 'out', scene);
  mkdirSync(outDir, { recursive: true });

  const ownServer = !server;
  const srv = server ?? await startServer(port);
  const ownBrowser = !browser;
  const b = browser ?? await launch({ url: srv.url, width, height, scale, headless });

  try {
    const clock = createClock(b.page, { fps, mode });
    // After __cdpReady (launch() already waited) -- freezing time before the
    // readiness poll settles would stall init.
    await clock.install();

    const capture = createCapture(b.page, { outDir });
    const manifest = createManifest({
      outDir, scene, fps, width, height, scale,
      capturedAt: new Date().toISOString(),
    });

    const ctx = { page: b.page, clock, capture, manifest, outDir, fps, scale, cursor, args: sceneArgs };
    const a = createActions(ctx);

    const mod = await import(pathToFileURL(join(DEMO, 'scenes', `${scene}.mjs`)).href);
    await mod.default(a, ctx);

    const frames = await capture.drain();
    const doc = manifest.write(frames);
    return { outDir, frames, doc, errors: b.errors };
  } finally {
    if (ownBrowser) await b.close();
    if (ownServer) srv.stop();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs();
  const { scene = 'recipe-preview', ...rest } = args;
  // Only pass through the cursor keys the user actually set, so unset ones keep
  // their CURSOR_DEFAULTS rather than becoming NaN.
  const cursor = {};
  for (const k of ['speed', 'dragSpeed', 'minSeconds', 'maxSeconds']) {
    if (rest[k] != null) cursor[k] = Number(rest[k]);
  }
  if (rest.easing) cursor.easing = rest.easing;

  const r = await runScene({
    scene,
    sceneArgs: rest,
    fps: Number(rest.fps ?? 30),
    scale: Number(rest.scale ?? 2),
    headless: rest.headed !== 'true',
    mode: rest.mode ?? 'lockstep',
    out: rest.out,
    cursor,
  });
  console.log(`[rig] ${scene}: ${r.frames} frames -> ${r.outDir}`);
  if (r.doc.audio.length) {
    for (const x of r.doc.audio) {
      console.log(`[rig]   audio ${x.id} @ frame ${x.startFrame}  ${x.seconds.toFixed(2)}s  ${x.sampleRate}Hz`);
    }
  }
  if (r.errors.length) console.warn(`[rig] page errors: ${r.errors.length}`);
}
