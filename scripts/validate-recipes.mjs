// validate-recipes.mjs — render every demo recipe headlessly and assert it
// produces real audio. Mirrors the patcher: it reconstructs the live node shape
// (genId/state/effectId) that GraphRunner expects from each recipe's serialized
// JSON, then runs the graph through the actual GraphRunner used by the demo.
//
//   node npm/scripts/validate-recipes.mjs
//
// Exits non-zero if any recipe errors or yields empty/silent output.

// Minimal DOM stub so demo/ui.js imports in Node (its DOM use is inside functions
// the runner never calls; log() just buffers).
globalThis.document ??= { getElementById: () => null, createElement: () => ({ style: {} }), createElementNS: () => ({ style: {} }), addEventListener: () => {}, body: { appendChild: () => {} } };
globalThis.addEventListener ??= () => {};

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { CDP, EFFECTS, ENVELOPE_PARAMS, decodeAudio } from '@olilarkin/cdp-wasm';
import { GraphRunner } from '../src/core/graph.js';
import { RECIPES } from '../src/data/recipes.js';

const DEMO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const byId = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));

// serialized recipe node -> live patcher node (what GraphRunner reads)
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
      // url sources (bundled demo sounds) are fetched in the browser; here we read
      // the file from disk and inject the bytes so the runner has audio to process.
      const source = { ...s.source };
      if (s.source?.url) source.wav = new Uint8Array(readFileSync(resolve(DEMO, s.source.url)));
      return { ...base, source };
    }
    case 'breakpoint': return { ...base, bp: s.bp };
    default: return base; // pvocAnalyse / pvocResynth / output
  }
}

function toPatch(recipe) {
  const nodes = new Map(recipe.nodes.map((s) => [s.id, liveNode(s)]));
  return { nodes, edges: recipe.edges };
}

const cdp = new CDP();
const runner = new GraphRunner(cdp);
let fail = 0;
let skip = 0;

for (const recipe of RECIPES) {
  const name = recipe.metadata?.name || '(unnamed)';
  // Faust recipes compile their DSP with the in-browser Faust compiler (the
  // esm-bundle needs a browser); they can't render in this headless Node check.
  if (recipe.nodes.some((n) => n.type === 'faust' || n.type === 'faustGenerator' || n.type === 'faustEffect')) {
    console.log(`• ${name.padEnd(26)} skipped (Faust DSP compiles in-browser only)`);
    skip++; continue;
  }
  const out = recipe.nodes.find((n) => n.type === 'output');
  if (!out) { console.log(`✗ ${name}: no output node`); fail++; continue; }
  try {
    const patch = toPatch(recipe);
    const bytes = await runner.run(patch, out.id);
    const audio = decodeAudio(bytes);
    const frames = audio.channelData?.[0]?.length ?? audio.length ?? 0;
    let peak = 0;
    const ch = audio.channelData?.[0] || [];
    for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a; }
    if (!bytes?.length || frames < 1) throw new Error('empty output');
    const dur = (frames / (audio.sampleRate || 44100)).toFixed(2);
    const flag = peak < 1e-4 ? ' ⚠ silent' : '';
    console.log(`✓ ${name.padEnd(26)} ${audio.channelData?.length || 1}ch ${dur}s peak ${peak.toFixed(3)}${flag}`);
    if (peak < 1e-4) fail++;
  } catch (err) {
    console.log(`✗ ${name.padEnd(26)} ${String(err.message || err).split('\n')[0]}`);
    fail++;
  }
}

const checked = RECIPES.length - skip;
console.log(`\n${checked - fail}/${checked} recipes produce audio${skip ? ` (${skip} Faust recipe${skip > 1 ? 's' : ''} skipped — browser-only)` : ''}`);
process.exit(fail ? 1 : 0);
