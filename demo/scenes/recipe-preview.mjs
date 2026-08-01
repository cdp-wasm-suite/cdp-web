// A short clip for one recipe: load it, run it, watch the waveform land, listen.
// Parameterised so the same scene generates a preview for every recipe in the
// catalogue -- README GIFs, recipes/README.md previews, regression frames.
//
//   node rig/run-scene.mjs --scene recipe-preview --recipe "Gritty saw"

import { RECIPES } from '../../src/data/recipes.js';

export default async function recipePreview(a, ctx) {
  const wanted = ctx.args.recipe;
  const recipe = wanted
    ? RECIPES.find((r) => r.metadata?.name?.toLowerCase() === String(wanted).toLowerCase())
    : RECIPES[0];
  if (!recipe) throw new Error(`no recipe named ${JSON.stringify(wanted)}`);

  const listenSecs = ctx.args.listen ? Number(ctx.args.listen) : undefined;

  await a.hold(0.3);

  const loadStart = a.frame;
  await a.loadRecipe(recipe, { settle: 0.6 });
  a.beat('load', {
    startFrame: loadStart,
    label: `Load: ${recipe.metadata.name}`,
    caption: { text: recipe.metadata.name, startFrame: loadStart, endFrame: a.frame + 30 },
  });

  // run() moves the cursor to this Output's Run button, presses it, and holds
  // frames until doRun re-enables the button.
  const runStart = a.frame;
  await a.run();
  a.beat('render', {
    startFrame: runStart,
    label: 'Render',
    caption: { text: 'Run', startFrame: runStart, endFrame: a.frame },
  });

  await a.hold(0.35);

  const listenStart = a.frame;
  const { audioRef, playhead } = await a.listen({ seconds: listenSecs });
  a.beat('listen', {
    startFrame: listenStart,
    label: 'Listen',
    audioRef, playhead,
    focus: playhead?.canvasRect ?? null,
    caption: { text: recipe.metadata.category, startFrame: listenStart, endFrame: a.frame },
  });

  await a.hold(0.4);
}
