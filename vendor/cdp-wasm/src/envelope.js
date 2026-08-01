// Envelope / breakpoint-file helpers built on CDP's `envel` program.
//
// A "breakpoint file" (BPF) is CDP's plain-text envelope format: whitespace-
// separated `time value` pairs, one per line, with times ascending. These
// helpers let a consuming app (e.g. cdp-web) extract a sound's amplitude
// envelope as editable points, transform them, and serialise them back to the
// `t v` text that `applyEffect(..., { brk: { <param> } })` and CDP `$DATA`
// inputs accept — closing the loop between "extract an envelope from a sound"
// and "drive a time-varying parameter with it".
//
// Everything here is layered on the low-level `CDP.run` interface, so it works
// in Node and the browser with the bundled `wasm/` modules.

/**
 * Parse CDP breakpoint text into `[time, value]` points. Blank lines and lines
 * beginning with `;` or `#` are ignored; each remaining line contributes its
 * first two whitespace-separated numbers.
 * @param {string} text
 * @returns {[number, number][]}
 */
export function parseBreakpoints(text) {
  const points = [];
  for (const line of String(text).split('\n')) {
    const s = line.trim();
    if (!s || s[0] === ';' || s[0] === '#') continue;
    const parts = s.split(/\s+/);
    const t = Number(parts[0]);
    const v = Number(parts[1]);
    if (Number.isFinite(t) && Number.isFinite(v)) points.push([t, v]);
  }
  return points;
}

/**
 * Serialise `[time, value]` points to CDP breakpoint text (tab-separated, one
 * pair per line, trailing newline). The result is ready to hand to
 * `applyEffect(cdp, effect, values, wav, { brk: { <param>: text } })` or to a
 * `$DATA` slot.
 * @param {[number, number][]} points
 * @param {object} [options]
 * @param {number} [options.precision=6] decimal places for both fields
 * @returns {string}
 */
export function formatBreakpoints(points, { precision = 6 } = {}) {
  return points
    .map(([t, v]) => `${Number(t).toFixed(precision)}\t${Number(v).toFixed(precision)}`)
    .join('\n') + '\n';
}

/**
 * Extract a sound's amplitude envelope as breakpoint points, via
 * `envel extract 2` (CDP's text-BPF extraction mode). Works on mono or
 * multichannel input (CDP scans the combined amplitude).
 *
 * @param {import('./index.js').CDP} cdp
 * @param {Uint8Array} wav  input WAV bytes
 * @param {object} [options]
 * @param {number} [options.windowMs=15]  scanning window in milliseconds
 *   (CDP range: 5 – file length). Smaller tracks fast transients; larger gives
 *   a smoother contour.
 * @param {number|null} [options.dataReduce=0.05]  0–1 thinning of the output
 *   (higher = fewer points, less accurate). Pass `null` for no reduction.
 * @returns {Promise<[number, number][]>}  `[time, value]` points
 */
export async function extractEnvelope(cdp, wav, { windowMs = 15, dataReduce = 0.05 } = {}) {
  const args = ['extract', '2', '/in.wav', '/out.brk', String(windowMs)];
  if (dataReduce != null) args.push(`-d${dataReduce}`);
  const res = await cdp.run('envel', args, {
    inputs: { '/in.wav': wav },
    outputs: ['/out.brk'],
  });
  const out = res.outputs['/out.brk'];
  if (!out) {
    throw new Error(
      `envel extract produced no envelope (exit ${res.exitCode}).\n${res.stderr || res.stdout}`.trim()
    );
  }
  return parseBreakpoints(new TextDecoder().decode(out));
}

/**
 * `envel replot` warp modes: transform a breakpoint envelope into another one.
 * Map of mode name → mode number (as accepted by CDP). See `warpBreakpoints`.
 */
export const REPLOT_MODES = {
  normalise: 1, reverse: 2, exaggerate: 3, attenuate: 4, lift: 5,
  timestretch: 6, flatten: 7, gate: 8, invert: 9, limit: 10,
  corrugate: 11, expand: 12, trigger: 13, ceiling: 14, ducked: 15,
};

/**
 * Warp a breakpoint envelope with `envel replot`, returning transformed points.
 * Parameter-free modes (`normalise`, `reverse`) need no `params`; others take
 * mode-specific values passed through in order (e.g. `exaggerate` → `[factor]`,
 * `invert` → `[gate, mirror]`, `gate` → `[gate, smoothing]`). `trigger` (mode
 * 13) needs a ramp file and is not supported here.
 *
 * @param {import('./index.js').CDP} cdp
 * @param {[number, number][]} points  input envelope
 * @param {number|keyof typeof REPLOT_MODES} mode  mode number or name
 * @param {object} [options]
 * @param {number} [options.windowMs=15]  enveloping window in milliseconds
 * @param {number[]} [options.params=[]]  mode-specific parameters, in order
 * @param {number|null} [options.dataReduce=null]  0–1 output thinning
 * @returns {Promise<[number, number][]>}
 */
export async function warpBreakpoints(cdp, points, mode, { windowMs = 15, params = [], dataReduce = null } = {}) {
  const modeNum = typeof mode === 'number' ? mode : REPLOT_MODES[mode];
  if (!modeNum) throw new Error(`unknown replot mode: ${mode}`);
  if (modeNum === 13) throw new Error('replot mode 13 (trigger) needs a ramp file and is not supported by warpBreakpoints');
  const args = ['replot', String(modeNum), '/in.brk', '/out.brk', String(windowMs), ...params.map(String)];
  if (dataReduce != null) args.push(`-d${dataReduce}`);
  const res = await cdp.run('envel', args, {
    inputs: { '/in.brk': new TextEncoder().encode(formatBreakpoints(points)) },
    outputs: ['/out.brk'],
  });
  const out = res.outputs['/out.brk'];
  if (!out) {
    throw new Error(
      `envel replot ${modeNum} produced no output (exit ${res.exitCode}).\n${res.stderr || res.stdout}`.trim()
    );
  }
  return parseBreakpoints(new TextDecoder().decode(out));
}
