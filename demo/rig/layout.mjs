// Where should each node go, so the graph reads?
//
// A left-to-right row is wrong for anything but a straight chain. Cross-synthesis
// (Vocoder) is two branches merging; a row forces the branches to overlap and the
// picture stops explaining anything.
//
// The app already solves this: layoutGraph() in src/core/graph.js does
// longest-path layering plus a barycentre sweep, which is what File-menu recipes
// and Cmd+L use. Reuse it rather than inventing a second layout.
//
// It needs each node's measured width and height -- and the size depends on the
// node's own contents (a Chord generator grows once its notes textarea is filled).
// So measure first, in a throwaway pass the camera never sees.

import './dom-stub.mjs';   // graph.js pulls in ui.js; must load before it
import { layoutGraph } from '../../src/core/graph.js';

/** A clean two-node desktop, matching what the app boots with (patcher.js:2587). */
const BOOT_PATCH = {
  app: 'cdp-web-patch', v: 1,
  nodes: [
    { id: 'src', type: 'source', x: 30, y: 20 },
    { id: 'out', type: 'output', x: 560, y: 20 },
  ],
  edges: [],
};

/**
 * Load the finished recipe, read every window's real size, then restore a clean
 * desktop. Captures nothing: no verb runs, so no frame is snapped.
 *
 * loadPatch re-mints node ids, but it spawns in `data.nodes` order and
 * serialize() reports patch.nodes in insertion order, so index i corresponds to
 * recipe.nodes[i].
 */
export async function measureNodes(page, recipe) {
  const sizes = await page.evaluate((r) => {
    window.__patch.loadPatch(JSON.parse(JSON.stringify(r)), { arrange: false, resetSample: true });
    const ids = window.__patch.serialize().nodes.map((n) => n.id);
    return ids.map((id) => {
      const el = document.querySelector(`.gwin[data-node="${id}"]`);
      return { w: el?.offsetWidth || 220, h: el?.offsetHeight || 120 };
    });
  }, recipe);

  if (sizes.length !== recipe.nodes.length) {
    throw new Error(`measured ${sizes.length} nodes, recipe has ${recipe.nodes.length}`);
  }

  await page.evaluate((boot) => window.__patch.loadPatch(boot, { arrange: false, resetSample: true }), BOOT_PATCH);

  return new Map(recipe.nodes.map((n, i) => [n.id, sizes[i]]));
}

/**
 * Final position for every recipe node, keyed by SPEC id.
 *
 * Gaps are wider than the app's defaults (56/26): on video the cables need room
 * to be legible, and a viewer needs to see that two branches are separate.
 */
export function planLayout(recipe, sizes, { startX = 30, startY = 20, colGap = 90, rowGap = 60 } = {}) {
  const items = recipe.nodes.map((n) => ({ id: n.id, ...sizes.get(n.id) }));
  const pos = layoutGraph(items, recipe.edges, { startX, startY, colGap, rowGap });

  const plan = new Map();
  let right = 0, bottom = 0;
  for (const n of recipe.nodes) {
    const p = pos.get(n.id);
    const s = sizes.get(n.id);
    const x = Math.max(4, Math.round(p.x));
    const y = Math.max(4, Math.round(p.y));
    plan.set(n.id, { x, y, w: s.w, h: s.h });
    right = Math.max(right, x + s.w);
    bottom = Math.max(bottom, y + s.h);
  }
  return { plan, extent: { right, bottom } };
}
