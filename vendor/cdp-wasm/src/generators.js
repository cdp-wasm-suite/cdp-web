// CDP synthesis generators: leaf programs that create audio from scratch (no
// audio input). They mirror the EFFECTS catalog (see ./effects.js — same
// arg-template tokens and `buildArgs`), but take only `$OUT` (and optionally
// `$DATA`) — never `$IN`. The entries live in ./generators/; this module
// concatenates them into GENERATORS and holds applyGenerator.
//
// Each entry: { id, label, category, program, args, params, blurb,
//   mode?, data?, docUrl?, notes?, parityExempt? }.
//   - args:   template of literals, '$OUT', '$DATA', '$SR' (the session sample
//             rate, supplied via applyGenerator's `extra.sampleRate` — either a
//             whole token where the program takes the rate positionally, or
//             embedded in a flag like '-s$SR' where it doesn't), and
//             { p:'name'[, flag:'-x'] } param tokens (see effects.js grammar).
//   - params: numeric { name, label, min, max, default, step?, env? } or
//             choice  { name, label, choices:[[label,value],...], default }.
//             `env: true` marks a param that accepts a time-varying breakpoint
//             envelope (a consuming app lets you cable one in or draw one).
//   - docUrl: the section of CDP's own HTML reference documenting the program
//             (rendered as a link in docs/generators/). Absent when the CDP
//             reference has no section for the program — chirikov and strands
//             appear neither in the Release 8 docs nor the live site's index.
//   - data:   UI descriptor { label, placeholder, default } for the freeform
//             text staged as '$DATA'. `default` is what headless/test runs feed.
//   - notes:  something a caller needs that the params don't say — usually a
//             fixed argument the template pins, where the program's own usage
//             text describes a default we don't use. Rendered in the generator
//             reference and by consuming UIs alongside that usage text.
//   - parityExempt: note string when output is non-deterministic (rand()), so
//             the parity test only checks "both produce audio".

import { buildArgs } from './effects.js';

// One file per CDP program. (pulser synth is deliberately absent: it
// synthesizes correctly but hits an integer divide-by-zero trap on exit under
// WASM — see wasm/PORTING-STATUS.md.)
import synth from './generators/synth.js';
import clicknew from './generators/clicknew.js';
import impulse from './generators/impulse.js';
import multiosc from './generators/multiosc.js';
import synspline from './generators/synspline.js';
import chirikov from './generators/chirikov.js';
import multisynth from './generators/multisynth.js';
import strands from './generators/strands.js';
import newsynth from './generators/newsynth.js';

export const GENERATORS = [
  ...synth,
  ...clicknew,
  ...impulse,
  ...multiosc,
  ...synspline,
  ...chirikov,
  ...newsynth,
  ...multisynth,
  ...strands,
];

export const genById = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));

/**
 * Run a synthesis generator and return the produced WAV bytes. Mirrors
 * applyEffect's data/breakpoint handling, but stages no audio input.
 *
 * @param {import('./index.js').CDP} cdp
 * @param {object} gen   an entry from GENERATORS
 * @param {Record<string,number|string>} values  current parameter values
 * @param {{ brk?: Record<string,string|Uint8Array>, data?: string|Uint8Array }} [extra]
 *   `brk` supplies time-varying breakpoint envelopes (param name -> "t v\n..."),
 *   `data` overrides the freeform '$DATA' text (defaults to gen.data.default).
 * @returns {Promise<Uint8Array>}
 */
export async function applyGenerator(cdp, gen, values = {}, extra = {}) {
  const brk = extra.brk || {};
  const inputs = {};
  const vals = { ...values };
  // Breakpoint envelopes: replace the param value with a staged /brk_<name>.brk path.
  for (const name of Object.keys(brk)) {
    if (brk[name] == null || brk[name] === '') continue;
    const path = `/brk_${name}.brk`;
    inputs[path] = typeof brk[name] === 'string' ? new TextEncoder().encode(brk[name]) : brk[name];
    vals[name] = path;
  }
  // Freeform text data ('$DATA'): explicit override, else the generator's default.
  if (gen.args.includes('$DATA')) {
    const text = extra.data != null ? extra.data : (gen.data ? gen.data.default : undefined);
    if (text != null && String(text).trim()) {
      inputs['/data.txt'] = typeof text === 'string' ? new TextEncoder().encode(String(text)) : text;
    }
  }
  const sr = extra.sampleRate || 44100;   // session-configurable; '$SR' tokens in args resolve to this
  const mapped = buildArgs(gen, vals, sr).map((a) => (a === '$OUT' ? '/out.wav' : a === '$DATA' ? '/data.txt' : a));
  // Some generators number their output (out.wav -> out0.wav); accept either.
  const res = await cdp.run(gen.program, mapped, { inputs, outputs: ['/out.wav', '/out0.wav'] });
  const wav = res.outputs['/out.wav'] || res.outputs['/out0.wav'];
  if (!wav) throw new Error(`${gen.program} produced no output (exit ${res.exitCode}).\n${res.stderr || res.stdout}`.trim());
  return wav;
}
