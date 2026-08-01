// Verification: capturing the same scene twice must produce the same frames.
// This is the property that makes regenerated GIFs stable and regression
// screenshots meaningful. If it fails, something in the page is still reading a
// real clock (or a random seed) that the virtual clock does not reach.
//
//   node spike/determinism.mjs --recipe "Harmonic series"

import { readdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { runScene, parseArgs } from '../rig/run-scene.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha = (b) => createHash('sha256').update(b).digest('hex');

const args = parseArgs();
const recipe = args.recipe ?? 'Harmonic series';

const runs = [];
for (const tag of ['a', 'b']) {
  const outDir = join(REPO, 'demo', 'out', `_determinism-${tag}`);
  // Different ports so the two runs never share a server or a profile.
  const r = await runScene({
    scene: 'recipe-preview',
    sceneArgs: { recipe, listen: '0.5' },
    out: outDir,
    port: tag === 'a' ? 8131 : 8132,
  });
  const dir = join(outDir, 'frames');
  const frames = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
  runs.push({ tag, outDir, frames, hashes: frames.map((f) => sha(readFileSync(join(dir, f)))) });
  console.log(`[${tag}] ${r.frames} frames`);
}

const [a, b] = runs;
console.log('');

if (a.frames.length !== b.frames.length) {
  console.log(`FAIL -> frame counts differ: ${a.frames.length} vs ${b.frames.length}`);
  console.log('       a scene took a different number of frames to render; the clock is not');
  console.log('       fully controlling the page, or the WASM render raced the poll loop.');
  process.exit(1);
}

const diffs = [];
for (let i = 0; i < a.hashes.length; i++) if (a.hashes[i] !== b.hashes[i]) diffs.push(i);

console.log(`frames:        ${a.frames.length}`);
console.log(`identical:     ${a.frames.length - diffs.length}`);
console.log(`differing:     ${diffs.length}`);
if (diffs.length) {
  const show = diffs.slice(0, 12).join(', ');
  console.log(`first differing frames: ${show}${diffs.length > 12 ? ' …' : ''}`);
  console.log('');
  console.log('Inspect a pair with:');
  console.log(`  open ${join(a.outDir, 'frames', a.frames[diffs[0]])} \\`);
  console.log(`       ${join(b.outDir, 'frames', b.frames[diffs[0]])}`);
}

console.log('');
console.log(diffs.length === 0
  ? 'PASS -> capture is byte-reproducible.'
  : `FAIL -> ${diffs.length}/${a.frames.length} frames are not reproducible.`);
process.exit(diffs.length === 0 ? 0 : 1);
