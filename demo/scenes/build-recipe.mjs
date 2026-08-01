// Build a recipe the way a person would -- add each node from the menus, drag it
// into place, set its parameters, then patch the cables -- instead of dropping a
// finished graph in with loadPatch.
//
//   node rig/run-scene.mjs --scene build-recipe --recipe "Gritty saw"
//
// The graph it ends up with is the recipe's graph: the scene asserts that at the
// end by comparing the built patch's topology against the recipe spec.
//
// Not yet supported (the scene fails loudly rather than quietly building
// something else):
//   * envelope params -- would need the ∿ toggle plus a breakpoint editor drag
//   * faust / raw nodes

import { EFFECTS, GENERATORS } from 'cdp-wasm';
import { RECIPES } from '../../src/data/recipes.js';
import { measureNodes, planLayout } from '../rig/layout.mjs';

const fxById = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
const genById = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));

/**
 * Which menubar menu spawns this spec, and under what visible label.
 *
 * The menu and the quick-add palette label the PVOC bridges differently: the menu
 * spells out the domain ("PVOC Analyse (audio→spectral)", patcher.js:2258) while
 * the palette is terse ("PVOC Analyse", patcher.js:2340). Everything else shares
 * one label.
 */
function menuFor(spec) {
  switch (spec.type) {
    case 'generator': {
      const g = genById[spec.gen.id];
      if (!g) throw new Error(`unknown generator ${spec.gen.id}`);
      return { menu: 'generate', label: g.label, palette: g.label };
    }
    case 'transform': {
      const fx = fxById[spec.effectId];
      if (!fx) throw new Error(`unknown effect ${spec.effectId}`);
      // Spectral effects live under PVOC; sound-domain ones under Process.
      return { menu: fx.domain === 'spectral' ? 'pvoc' : 'process', label: fx.label, palette: fx.label };
    }
    case 'pvocAnalyse':
      return { menu: 'pvoc', label: 'PVOC Analyse (audio→spectral)', palette: 'PVOC Analyse' };
    case 'pvocResynth':
      return { menu: 'pvoc', label: 'PVOC Resynthesise (spectral→audio)', palette: 'PVOC Resynthesise' };
    default: throw new Error(`cannot build a "${spec.type}" node from the menus yet`);
  }
}

/** Param metadata for a spec, so we know each param's label and whether it's a choice. */
function paramsOf(spec) {
  if (spec.type === 'generator') return genById[spec.gen.id]?.params ?? [];
  if (spec.type === 'transform') return fxById[spec.effectId]?.params ?? [];
  return [];
}

const valuesOf = (spec) => (spec.type === 'generator' ? spec.gen.values : spec.state?.values) ?? {};
const envsOf = (spec) => (spec.type === 'generator' ? spec.gen.envs : spec.state?.envs) ?? {};

export default async function buildRecipe(a, ctx) {
  const wanted = ctx.args.recipe ?? 'Gritty saw';
  const recipe = RECIPES.find((r) => r.metadata?.name?.toLowerCase() === wanted.toLowerCase());
  if (!recipe) throw new Error(`no recipe named ${JSON.stringify(wanted)}`);

  for (const s of recipe.nodes) {
    if (Object.keys(envsOf(s)).length) {
      throw new Error(`"${recipe.metadata.name}" drives ${s.type} params from an envelope; ` +
        `building that on camera is not implemented yet (use --scene recipe-preview)`);
    }
  }

  const listenSecs = ctx.args.listen ? Number(ctx.args.listen) : undefined;
  const specs = recipe.nodes;
  const idMap = new Map();   // spec id -> live node id

  // Work out where every node belongs BEFORE building anything, so each one is
  // created in its final place. This loads the finished recipe, measures each
  // window, then restores a clean desktop. It captures nothing: no verb runs, so
  // no frame is snapped.
  //
  // Measuring the *finished* recipe matters -- a node's size depends on its own
  // contents. A Chord generator grows once its notes textarea is filled, so a
  // size read before the params are set is too small and the next node lands on
  // top of it.
  const sizes = await measureNodes(a.page, recipe);
  const { plan, extent } = planLayout(recipe, sizes);

  // The app boots with a Source and an Output already on the desktop.
  await a.hold(0.4);
  const live = await a.nodeIds();
  const types = await a.nodeTypes();
  const defaultSource = live.find((id) => types[id] === 'source');
  const defaultOutput = live.find((id) => types[id] === 'output');

  const outSpec = specs.find((s) => s.type === 'output');
  const srcSpecs = specs.filter((s) => s.type === 'source');
  if (outSpec) idMap.set(outSpec.id, defaultOutput);

  const start = a.frame;

  // ---- The sources ------------------------------------------------------
  //
  // Fetch each bundled demo sound in the page and hand the bytes to the app.
  // The OS file picker is gesture-gated and unscriptable; setSource is the same
  // path the DAW-embedding host uses. It fills the first Source that has no
  // audio yet, so injecting one at a time and spawning a fresh empty Source in
  // between gives each recipe source its own node.
  const injectSource = async (spec) => {
    if (spec.source?.kind !== 'url') throw new Error('only url sources can be injected');
    const id = await a.page.evaluate(async ({ url, name }) => {
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      return window.__cdpHost.setSource(bytes, name).id;
    }, { url: spec.source.url, name: spec.source.name });
    idMap.set(spec.id, id);
    await a.hold(0.5);
    return id;
  };

  if (srcSpecs.length) {
    await injectSource(srcSpecs[0]);                       // fills the default Source
    for (const s of srcSpecs.slice(1)) {
      await a.addFromMenu('file', 'Add audio file source');  // a fresh empty Source
      await injectSource(s);
    }
  } else if (defaultSource) {
    // A generator-driven recipe has no use for the empty default Source.
    await a.deleteNode(defaultSource);
  }
  a.beat('setup', { startFrame: start, label: 'Start', caption: { text: recipe.metadata.name, startFrame: start, endFrame: a.frame } });

  // ---- Add each node at its planned position ----------------------------
  //
  // `plan` came from the app's own layoutGraph() (see rig/layout.mjs): layered by
  // longest path, ordered within a layer by barycentre. That is what makes a
  // cross-synthesis patch legible -- its two branches get their own rows instead
  // of being crushed into one line and overlapping.
  //
  // The recipe's own x/y are useless here: they pack nodes ~200px apart while a
  // real transform window is ~380px wide. Recipes get away with it because
  // loadPatch(recipe, {arrange:true}) throws those coordinates away.
  const at = (specId) => plan.get(specId);

  // Zoom out once so the whole finished layout is reachable. The mouse cannot
  // travel past the viewport, so a drag to an off-screen target stops short.
  await a.ensureRoom(extent.right, { patchBottom: extent.bottom });

  // Sources are already on the desktop; move them to their planned slots.
  for (const s of srcSpecs) {
    const p = at(s.id);
    await a.moveNode(idMap.get(s.id), p.x, p.y);
  }

  // The Output boots at x=560, in the middle of the area we are about to build --
  // in palette mode a dblclick there would roll it up instead of opening
  // quick-add. Send it straight to its planned slot (the rightmost layer), where
  // it is out of the way and already correct. It cannot be deleted: it is the
  // only Output, and the app refuses.
  if (outSpec) {
    const p = at(outSpec.id);
    await a.moveNode(defaultOutput, p.x, p.y);
  }

  // `--via palette` double-clicks the empty desktop and picks from quick-add, so
  // each node is created exactly where it belongs and never overlaps. `--via menu`
  // (the default) spawns at the app's cascade position and drags the window into
  // place, which shows the menus but means every node briefly covers a neighbour.
  const via = ctx.args.via ?? 'menu';
  if (!['menu', 'palette'].includes(via)) throw new Error(`--via must be menu or palette`);

  for (const spec of specs) {
    if (spec.type === 'output' || spec.type === 'source') continue;

    const beatStart = a.frame;
    const { menu, label, palette } = menuFor(spec);
    const p = at(spec.id);

    let id;
    if (via === 'palette') {
      id = await a.addAtPoint(p.x, p.y, palette);
    } else {
      id = await a.addFromMenu(menu, label);
      await a.moveNode(id, p.x, p.y);
    }
    idMap.set(spec.id, id);

    const values = valuesOf(spec);
    for (const p of paramsOf(spec)) {
      if (values[p.name] == null) continue;
      if (p.choices) await a.setChoice(id, p.label, values[p.name]);
      else await a.setParam(id, p.label, values[p.name]);
    }
    // `data` is not a param. Miss it and e.g. the Chord generator keeps its
    // default notes: the graph is right, the sound is wrong.
    if (spec.type === 'generator' && spec.gen.data != null) {
      await a.setData(id, spec.gen.data);
    }

    a.beat(`add-${spec.id}`, {
      startFrame: beatStart,
      label: `Add ${label}`,
      caption: { text: label, startFrame: beatStart, endFrame: a.frame },
    });
  }

  // Every node is already at its planned slot; this only guards against a node
  // that turned out taller than measured (an off-screen port cannot be dragged).
  await a.fitContent();
  await a.hold(0.3);

  // ---- Patch the cables -------------------------------------------------
  const cableStart = a.frame;
  for (const e of recipe.edges) {
    const from = { node: idMap.get(e.from.node), port: e.from.port };
    const to = { node: idMap.get(e.to.node), port: e.to.port };
    if (!from.node || !to.node) throw new Error(`edge references a node that was never built: ${JSON.stringify(e)}`);
    await a.dragCable(from, to);
  }
  a.beat('patch', {
    startFrame: cableStart, label: 'Patch',
    caption: { text: 'Drag cables port to port', startFrame: cableStart, endFrame: a.frame },
  });

  // ---- The built graph must be the recipe's graph ------------------------
  await a.assertTopology(recipe, idMap);

  // ---- Run and listen ---------------------------------------------------
  const runStart = a.frame;
  await a.run();
  a.beat('render', { startFrame: runStart, label: 'Render', caption: { text: 'Run', startFrame: runStart, endFrame: a.frame } });

  await a.hold(0.35);
  const listenStart = a.frame;
  const { audioRef, playhead } = await a.listen({ seconds: listenSecs });
  a.beat('listen', {
    startFrame: listenStart, label: 'Listen', audioRef, playhead,
    focus: playhead?.canvasRect ?? null,
    caption: { text: recipe.metadata.category, startFrame: listenStart, endFrame: a.frame },
  });
  await a.hold(0.5);
}
