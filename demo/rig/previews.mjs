// Capture a short preview for every recipe in the catalogue.
//
//   node rig/previews.mjs                    # all recipes
//   node rig/previews.mjs --only Spectral    # only categories/names matching
//   node rig/previews.mjs --encode           # also produce an mp4 per recipe
//
// One serve.mjs for the whole batch; a fresh browser context per recipe, because
// the app restores localStorage['cdp-web-patch'] on load and a shared profile
// would leak the previous recipe's graph into the next capture.
//
// Faust recipes DO work here: they compile in a real browser, unlike the headless
// scripts/validate-recipes.mjs check which has to skip them.

import { pathToFileURL } from 'node:url';
import { startServer } from './browser.mjs';
import { runScene, parseArgs } from './run-scene.mjs';
import { encode } from './encode.mjs';
import { RECIPES } from '../../src/data/recipes.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const args = parseArgs();
const scene = args.scene ?? 'recipe-preview';
const only = args.only?.toLowerCase();
const wanted = RECIPES.filter((r) => !only
  || r.metadata.name.toLowerCase().includes(only)
  || r.metadata.category.toLowerCase().includes(only));

if (!wanted.length) {
  console.error(`no recipes match --only ${JSON.stringify(args.only)}`);
  process.exit(1);
}

const server = await startServer(Number(args.port ?? 8140));
const ok = [];
const failed = [];

try {
  for (const [i, recipe] of wanted.entries()) {
    const name = recipe.metadata.name;
    const outScene = `${scene === 'recipe-preview' ? 'preview' : 'build'}/${slug(name)}`;
    process.stdout.write(`[${i + 1}/${wanted.length}] ${name.padEnd(28)} `);
    try {
      const r = await runScene({
        scene,
        sceneArgs: { recipe: name, listen: args.listen ?? '3' },
        out: new URL(`../out/${outScene}/`, import.meta.url).pathname,
        server,
      });
      let extra = '';
      if (args.encode === 'true') {
        await encode({ scene: outScene });
        extra = ' + mp4';
      }
      console.log(`${String(r.frames).padStart(4)} frames  ${r.doc.audio[0]?.seconds.toFixed(1) ?? '?'}s audio${extra}`);
      ok.push(name);
    } catch (e) {
      console.log(`FAILED  ${e.message.split('\n')[0]}`);
      failed.push({ name, error: e.message });
    }
  }
} finally {
  server.stop();
}

console.log('');
console.log(`captured ${ok.length}/${wanted.length}`);
if (failed.length) {
  console.log('');
  for (const f of failed) console.log(`  ✗ ${f.name}: ${f.error.split('\n')[0]}`);
  process.exit(1);
}
