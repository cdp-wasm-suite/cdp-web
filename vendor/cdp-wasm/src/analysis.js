// Analysis helpers: pull editable data — a pitch contour, event markers — out of
// a sound, built on CDP's `pvoc`/`repitch`/`peakfind` programs. Companion to the
// envelope helpers (see envelope.js); same low-level `CDP.run` pattern, so they
// run in Node and the browser. The `[time, value]` / time-list results are ready
// to draw, edit, or feed back through `applyEffect(..., { brk })`.

import { parseBreakpoints } from './envelope.js';
import { conformChannels } from './effects.js';

/**
 * Extract a sound's pitch contour, via `pvoc anal → repitch getpitch`. Pitch
 * tracking is monophonic, so multichannel input is mixed to mono first. Returns
 * `[time, frequencyHz]` points for the moments CDP found a stable pitch (its
 * data-reduced contour). A sound with no trackable pitch — silence, noise, or a
 * pure sine with no harmonics — yields an **empty array** rather than an error.
 *
 * @param {import('./index.js').CDP} cdp
 * @param {Uint8Array} wav  input WAV bytes
 * @returns {Promise<[number, number][]>}  `[time, Hz]` points (empty if unpitched)
 */
export async function getPitch(cdp, wav) {
  const mono = conformChannels(wav, 'mono');
  const ana = (await cdp.process('pvoc', ['anal', '1', '$IN', '$OUT'], mono, { outExt: 'ana' })).bytes;
  const r = await cdp.run('repitch', ['getpitch', '2', '/in.ana', '/o.wav', '/p.txt'], {
    inputs: { '/in.ana': ana },
    outputs: ['/p.txt'],
  });
  // repitch getpitch exits non-zero and writes nothing when it can't track a
  // pitch — a valid "no pitch here" result, not a failure to surface.
  const t = r.outputs['/p.txt'];
  return t ? parseBreakpoints(new TextDecoder().decode(t)) : [];
}

/**
 * Find the times of amplitude peaks in a sound, via `peakfind` — transient /
 * onset markers, useful for slicing. Works on mono or multichannel input.
 *
 * @param {import('./index.js').CDP} cdp
 * @param {Uint8Array} wav  input WAV bytes
 * @param {object} [options]
 * @param {number} [options.windowMs=50]  window (ms) for locating successive
 *   peaks — roughly the minimum spacing between reported peaks.
 * @param {number|null} [options.threshold=null]  0–1 level below which peaks are
 *   ignored within a window; `null` uses CDP's adaptive default (1/5 of the
 *   local maximum).
 * @returns {Promise<number[]>}  peak times in seconds
 */
export async function findPeaks(cdp, wav, { windowMs = 50, threshold = null } = {}) {
  const args = ['peakfind', '/in.wav', '/out.txt', String(windowMs)];
  if (threshold != null) args.push(`-t${threshold}`);
  const r = await cdp.run('peakfind', args, { inputs: { '/in.wav': wav }, outputs: ['/out.txt'] });
  const t = r.outputs['/out.txt'];
  if (!t) {
    throw new Error(
      `peakfind produced no output (exit ${r.exitCode}).\n${r.stderr || r.stdout}`.trim()
    );
  }
  // peakfind writes a single-column list of times (one per line).
  return new TextDecoder().decode(t)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => Number(l.split(/\s+/)[0]))
    .filter((n) => Number.isFinite(n));
}
