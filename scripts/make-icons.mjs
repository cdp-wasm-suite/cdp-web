// Build the app icons in ./img from the suite's icon artwork.
//
// Source: design/icon/nodes.png — the same black-on-transparent patcher drawing
// the cdp-plugin App Store icon uses (its Assets/"Nodes 3.png", trimmed to the
// artwork's own bounds), so the home-screen icon, the plugin and the App Store
// listing all read as one product. The green is sampled from that icon's Apple
// "automatic gradient", which is why it's a lighter green than the app's desk.
//
// Two framings, because Android crops what it's given:
//   - "any"      — artwork at 82% width. Shown as-is, or under a light mask
//                  (iOS's squircle), which only bites the corners.
//   - "maskable" — artwork at 64% width, so everything survives the aggressive
//                  circular crop a launcher is allowed to apply.
//
// Dev-only and manual: it needs ImageMagick (`brew install imagemagick`), the
// outputs are committed, and nothing in the build or CI runs it. Re-run it with
// `node scripts/make-icons.mjs` after changing the artwork.

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const art = join(root, 'design/icon/nodes.png');
const img = (name) => join(root, 'img', name);

const TOP = '#78C661';       // gradient endpoints sampled from the plugin's 1024px icon
const BOTTOM = '#4BA830';
const SIDE = 1024;           // master size everything is rendered from

if (!existsSync(art)) {
  console.error(`✗ missing artwork: ${art}`);
  process.exit(1);
}

const magick = (args) => {
  try { execFileSync('magick', args, { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) {
    console.error('✗ ImageMagick failed (is `magick` installed?)\n' + (e.stderr?.toString() || e.message));
    process.exit(1);
  }
};

// A favicon is 16–32px, where the four little windows collapse into a smudge, so
// the tab icon is one window from the same drawing — the leftmost — blown up.
const ONE_WINDOW = '142x144+0+8';

// One full-bleed square: gradient background + artwork centred at `frac` of the
// width. `crop` takes a piece of the drawing instead of all of it; `flatten`
// drops the alpha channel.
const compose = (out, { frac, size, crop = null, flatten = false }) => magick([
  '-size', `${SIDE}x${SIDE}`, `gradient:${TOP}-${BOTTOM}`,
  '(', art, ...(crop ? ['-crop', crop, '+repage'] : []), '-resize', `${Math.round(SIDE * frac)}x`, ')',
  '-gravity', 'center', '-composite',
  '-resize', `${size}x${size}`,
  ...(flatten ? ['-background', BOTTOM, '-alpha', 'remove', '-alpha', 'off'] : []),
  // 8-bit and stripped: the gradient renders at 16-bit by default, which triples
  // the file size of an asset nobody will ever look at that closely.
  '-depth', '8', '-strip', out,
]);

const jobs = {
  'icon-512.png': { frac: 0.82, size: 512 },
  'icon-192.png': { frac: 0.82, size: 192 },
  'icon-maskable-512.png': { frac: 0.64, size: 512 },
  // iOS rounds the corners itself and shows no transparency, so this one is flat.
  'apple-touch-icon.png': { frac: 0.82, size: 180, flatten: true },
  'favicon-32.png': { frac: 0.66, size: 32, crop: ONE_WINDOW },
  'favicon-16.png': { frac: 0.66, size: 16, crop: ONE_WINDOW },
};
for (const [name, spec] of Object.entries(jobs)) {
  compose(img(name), spec);
  console.log(`✓ img/${name} — ${spec.size}px`);
}
