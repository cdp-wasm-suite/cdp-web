// Verification: the WAV the rig pulls out of the browser must be the same audio
// the headless GraphRunner produces for the same recipe. If these ever diverge,
// the demo video is showing something the app doesn't actually do.
//
//   node spike/audio-integrity.mjs --recipe "Harmonic series"
//
// Mirrors scripts/validate-recipes.mjs's reconstruction of the live node shape.

import '../rig/dom-stub.mjs';   // must come first -- see the note in that file
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { CDP, EFFECTS, ENVELOPE_PARAMS } from 'cdp-wasm';
import { GraphRunner } from '../../src/core/graph.js';
import { RECIPES } from '../../src/data/recipes.js';
import { runScene } from '../rig/run-scene.mjs';
import { wavInfo, wavData } from '../rig/manifest.mjs';
import { parseArgs } from '../rig/run-scene.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const byId = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

function liveNode(s) {
  const base = { id: s.id, type: s.type, x: s.x, y: s.y, paramPorts: [] };
  switch (s.type) {
    case 'generator':
      return { ...base, genId: s.gen.id, state: { values: s.gen.values || {}, envs: s.gen.envs || {} }, data: s.gen.data };
    case 'transform': {
      const envParams = ENVELOPE_PARAMS[s.effectId] || [];
      const paramPorts = (byId[s.effectId]?.params || [])
        .filter((p) => envParams.includes(p.name)).map((p) => ({ name: 'param:' + p.name, kind: 'breakpoint' }));
      return { ...base, effectId: s.effectId, state: { values: s.state?.values || {}, envs: s.state?.envs || {} }, paramPorts };
    }
    case 'source': {
      const source = { ...s.source };
      if (s.source?.url) source.wav = new Uint8Array(readFileSync(resolve(REPO, s.source.url)));
      return { ...base, source };
    }
    case 'breakpoint': return { ...base, bp: s.bp };
    case 'pick': return { ...base, state: { values: { ...(s.pick?.values || { index: 1 }) }, envs: {} } };
    case 'gather': {
      const count = Math.max(2, Number(s.gather?.inputs) || 2);
      return { ...base, inPorts: Array.from({ length: count }, (_, i) => ({ name: 'in' + (i + 1), kind: 'audio' })) };
    }
    default: return base;
  }
}

const sha = (b) => createHash('sha256').update(b).digest('hex').slice(0, 16);

/** Peak of the 16-bit PCM payload, as validate-recipes.mjs checks. */
function peak(buf) {
  const info = wavInfo(buf);
  const start = buf.length - info.frames * info.channels * (info.bitsPerSample / 8);
  let max = 0;
  for (let i = start; i + 1 < buf.length; i += 2) max = Math.max(max, Math.abs(buf.readInt16LE(i)));
  return max / 32768;
}

const args = parseArgs();
const name = args.recipe ?? 'Harmonic series';
const recipe = RECIPES.find((r) => r.metadata?.name?.toLowerCase() === name.toLowerCase());
if (!recipe) throw new Error(`no recipe named ${JSON.stringify(name)}`);

// 1. Browser render, captured by the rig. `--scene build-recipe` proves that a
// patch assembled through the UI -- menus, drags, sliders -- renders the same
// audio as the recipe it was built from.
const scene = args.scene ?? 'recipe-preview';
const outDir = join(REPO, 'demo', 'out', '_integrity');
const r = await runScene({ scene, sceneArgs: { recipe: name, listen: '0.2' }, out: outDir });
const captured = Buffer.from(readFileSync(join(outDir, r.doc.audio[0].file)));

// 2. Headless reference render, straight through GraphRunner.
//
// GraphRunner.sampleRate defaults to 44100 (graph.js:168), but the app assigns
// it the session rate, which defaults to 48000 (patcher.js:373). Match the rate
// the page actually rendered at, or the two differ for a reason that has nothing
// to do with the capture being wrong.
const cdp = new CDP();
const runner = new GraphRunner(cdp);
runner.sampleRate = wavInfo(captured).sampleRate;
const patch = { nodes: new Map(recipe.nodes.map((s) => [s.id, liveNode(s)])), edges: recipe.edges };
const outId = recipe.nodes.find((n) => n.type === 'output').id;
const reference = Buffer.from((await runner.run(patch, outId)).bytes);

// 3. Compare. Whole-file equality is the WRONG test: CDP writes a PEAK chunk
// carrying a timestamp and a LIST/adtl note carrying a DATE string, so two
// renders of the same graph never produce the same bytes. The PCM `data` chunk
// is the reproducible part, and the thing the video actually plays.
const refInfo = wavInfo(reference);
const capInfo = wavInfo(captured);
const refPcm = wavData(reference);
const capPcm = wavData(captured);

const fmtMatch = refInfo.sampleRate === capInfo.sampleRate
  && refInfo.channels === capInfo.channels
  && refInfo.bitsPerSample === capInfo.bitsPerSample;
const pcmIdentical = refPcm.equals(capPcm);
const nonSilent = peak(captured) > 1e-4;

// If the PCM differs, quantify it: a max delta of an LSB or two out of 32768 is
// float rounding across two WASM instances, not a different render.
let maxDelta = 0, diffSamples = 0;
if (!pcmIdentical && refPcm.length === capPcm.length) {
  for (let i = 0; i + 1 < refPcm.length; i += 2) {
    const d = Math.abs(refPcm.readInt16LE(i) - capPcm.readInt16LE(i));
    if (d) { diffSamples++; maxDelta = Math.max(maxDelta, d); }
  }
}
const rounding = !pcmIdentical && refPcm.length === capPcm.length && maxDelta <= 2;

console.log(`recipe:     ${name}   (scene: ${scene})`);
console.log(`reference:  ${refInfo.seconds.toFixed(3)}s @${refInfo.sampleRate}Hz x${refInfo.channels}  pcm ${refPcm.length}B  sha ${sha(refPcm)}  peak ${peak(reference).toFixed(4)}`);
console.log(`captured:   ${capInfo.seconds.toFixed(3)}s @${capInfo.sampleRate}Hz x${capInfo.channels}  pcm ${capPcm.length}B  sha ${sha(capPcm)}  peak ${peak(captured).toFixed(4)}`);
console.log(`chunks:     ${capInfo.chunks.map((c) => c.id.trim()).join(' ')}`);
console.log('');
console.log(`  format matches:   ${fmtMatch ? 'YES' : 'NO'}`);
console.log(`  pcm identical:    ${pcmIdentical ? 'YES' : 'NO'}`);
console.log(`  non-silent:       ${nonSilent ? 'YES' : 'NO'}`);

if (!pcmIdentical) {
  console.log('');
  if (refPcm.length !== capPcm.length) {
    console.log(`  pcm length delta: ${capPcm.length - refPcm.length} bytes -- different audio, not rounding.`);
  } else {
    console.log(`  differing samples: ${diffSamples}/${refPcm.length / 2}`);
    console.log(`  max sample delta:  ${maxDelta} of 32768`);
    console.log(`  verdict: ${rounding ? 'LSB rounding across WASM instances' : 'REAL DIVERGENCE -- investigate'}`);
  }
}

const ok = fmtMatch && nonSilent && (pcmIdentical || rounding);
console.log('');
console.log(ok
  ? 'PASS -> the browser render is the same audio the GraphRunner produces.'
  : 'FAIL -> the captured audio is not what the app computes.');
process.exit(ok ? 0 : 1);
