// Shared machinery for the effect entries in this directory: the pvoc analysis
// step, the pitch-data pipelines, deterministic data-file generators, and the
// channel/rate conformers (also used by applyEffect, and re-exported from
// ../effects.js as part of the public surface).

import { decodeAudio, encodeWav } from '../wav.js';

/** Analyse a mono WAV to a PVOCEX .ana byte array. */
export async function analyse(cdp, monoWav) {
  return (await cdp.process('pvoc', ['anal', '1', '$IN', '$OUT'], monoWav, { outExt: 'ana' })).bytes;
}

/**
 * Check that a CDP run wrote a usable file, or throw with its own diagnostics.
 * A failing program often still creates (and leaves behind) an empty outfile,
 * and an empty Uint8Array is truthy — so a bare `if (!bytes)` lets that
 * zero-length file travel to the next stage, where the real error is replaced
 * by a confusing one from a program fed rubbish.
 *
 * The exit code is reported but deliberately NOT part of the test: some CDP
 * programs write their output fine and then exit non-zero on a housekeeping
 * complaint (isolate ends with "Error in read-write accounting"), so failing on
 * it alone would reject good audio. Usable bytes are the signal.
 */
export function requireOutput(res, bytes, program, what = 'output') {
  if (!bytes || bytes.length === 0) throw noOutputError(res, program, what);
  return bytes;
}

/**
 * Both streams of a failed run, stdout first: the CDP framework prints its usage
 * and range errors to stdout, while stderr may carry only a program's own debug
 * chatter (panorama, for one), so picking one stream can hide the diagnosis.
 */
export function noOutputError(res, program, what = 'output') {
  const detail = [res.stdout, res.stderr].map((s) => (s || '').trim()).filter(Boolean).join('\n');
  return new Error(`${program} produced no ${what} (exit ${res.exitCode}).\n${detail}`.trim());
}

/**
 * `pitch octmove`/`altharms` operate on a spectral file but also need a *binary*
 * pitchfile derived from the same input (`repitch getpitch 1` → .frq). Chain:
 *   pvoc anal → repitch getpitch (.frq) → pitch <mode> → pvoc synth (mono).
 * `modeArgs` is the `pitch` argument list with `$ANA`/`$PFRQ`/`$OUT` placeholders.
 * Falls back to the analysis round-trip when the source has no detectable pitch.
 */
export async function pitchFromAnalysis(cdp, srcWav, modeArgs) {
  const ana = await analyse(cdp, conformChannels(srcWav, 'mono'));
  try {
    const gp = await cdp.run('repitch', ['getpitch', '1', '/a.ana', '/pt.wav', '/p.frq'],
      { inputs: { '/a.ana': ana }, outputs: ['/p.frq'] });
    const frq = requireOutput(gp, gp.outputs['/p.frq'], 'repitch getpitch', 'pitch data');
    const args = modeArgs.map((a) => (a === '$ANA' ? '/a.ana' : a === '$PFRQ' ? '/p.frq' : a === '$OUT' ? '/o.ana' : a));
    const r = await cdp.run('pitch', args, { inputs: { '/a.ana': ana, '/p.frq': frq }, outputs: ['/o.ana'] });
    const out = requireOutput(r, r.outputs['/o.ana'], 'pitch');
    return (await cdp.process('pvoc', ['synth', '$IN', '$OUT'], out, { inExt: 'ana' })).bytes;
  } catch {
    return (await cdp.process('pvoc', ['synth', '$IN', '$OUT'], ana, { inExt: 'ana' })).bytes;
  }
}

/**
 * Pitch-data effects: extract the source's pitch contour, transform it, and
 * re-apply it to the audio as a (formant-preserving) transposition. The chain is
 *   pvoc anal -> repitch getpitch (.frq) -> repitch <mod> (.trn) -> repitch transposef -> pvoc synth
 * `mod.args(values)` is the middle step (quantise/smooth/invert) producing the
 * transposition file; `mod.qset` optionally supplies its scale data file.
 * If the source has no detectable pitch, falls back to the analysis round-trip.
 */
export async function pitchDataPipeline(cdp, srcWav, values, mod) {
  const ana = await analyse(cdp, conformChannels(srcWav, 'mono'));
  try {
    const gp = await cdp.run('repitch', ['getpitch', '1', '/a.ana', '/pt.wav', '/p.frq'],
      { inputs: { '/a.ana': ana }, outputs: ['/p.frq'] });
    if (!gp.outputs['/p.frq']) throw new Error('no pitch detected');
    const inputs = { '/p.frq': gp.outputs['/p.frq'] };
    if (mod.qset) inputs['/q.txt'] = new TextEncoder().encode(mod.qset(values));
    const md = await cdp.run('repitch', mod.args(values), { inputs, outputs: ['/t.trn'] });
    if (!md.outputs['/t.trn']) throw new Error('no transposition produced');
    const tf = await cdp.run('repitch', ['transposef', '4', '/a.ana', '/t.trn', '/o.ana', '-p8'],
      { inputs: { '/a.ana': ana, '/t.trn': md.outputs['/t.trn'] }, outputs: ['/o.ana'] });
    if (!tf.outputs['/o.ana']) throw new Error('transposef failed');
    return (await cdp.process('pvoc', ['synth', '$IN', '$OUT'], tf.outputs['/o.ana'], { inExt: 'ana' })).bytes;
  } catch {
    // No clearly-pitched material to work on: return the unmodified round-trip.
    return (await cdp.process('pvoc', ['synth', '$IN', '$OUT'], ana, { inExt: 'ana' })).bytes;
  }
}

/** Major-scale MIDI pitches over one octave from a root (CDP `-o` repeats them in all octaves). */
export function majorScale(root) {
  return [0, 2, 4, 5, 7, 9, 11].map((i) => root + i).join('\n') + '\n';
}

/**
 * Derive a pitch breakpoint file (time/frequency pairs) for the input by running
 * CDP's pitch tracker (`pvoc anal` → `repitch getpitch`). Falls back to a constant
 * pitch from the `pitch` parameter when the source isn't clearly pitched (a pure
 * tone or noise yields no breakpoints) — so the effect always has usable data.
 */
export async function derivePitch(cdp, monoWav, values) {
  try {
    const ana = await analyse(cdp, monoWav);
    const r = await cdp.run('repitch', ['getpitch', '2', '/in.ana', '/o.wav', '/p.txt'],
      { inputs: { '/in.ana': ana }, outputs: ['/p.txt'] });
    const t = r.outputs['/p.txt'];
    if (t && t.length) {
      const lines = new TextDecoder().decode(t).trim().split(/\r?\n/).filter(Boolean);
      if (lines.length >= 2) return t; // a usable, data-reduced pitch contour
    }
  } catch { /* fall through to the constant-pitch fallback */ }
  // Fallback: a constant pitch spanning the source (psow requires the breakpoint
  // file's time range to match the input's duration).
  const d = decodeAudio(monoWav);
  const dur = (d.length / d.sampleRate).toFixed(6);
  const hz = values.pitch || 220;
  return `0 ${hz}\n${dur} ${hz}\n`;
}

// Deterministic vertex layout for crystal.rotate: a seeded LCG (no
// Math.random) so the same settings always generate the same crystal.
export function crystalData(v) {
  let s = (Number(v.seed) * 2654435761) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const r = Number(v.radius);
  const lines = [];
  for (let n = 0; n < v.verts; n++) {
    let x, y, z;
    do { x = (rnd() * 2 - 1) * r; y = (rnd() * 2 - 1) * r; z = (rnd() * 2 - 1) * r; }
    while (x * x + y * y + z * z >= r * r);
    lines.push(`${x.toFixed(6)} ${y.toFixed(6)} ${z.toFixed(6)}`);
  }
  lines.push(`0 0`);
  lines.push(`${v.attack} 1`);
  lines.push(`${(Number(v.attack) + Number(v.decay)).toFixed(4)} 0`);
  return lines.join('\n') + '\n';
}

// Fragment envelope table for fracture.fracture: one line — TIME 0 plus 7
// time/level pairs rising to 1 at the peak position and falling back to 0.
export function fractureData(v) {
  const p = Number(v.peak);
  const pts = [[0, 0], [p / 2, 0.5], [p, 1],
    [p + (1 - p) * 0.25, 0.65], [p + (1 - p) * 0.5, 0.4], [p + (1 - p) * 0.75, 0.18], [1, 0]];
  return `0 ${pts.map(([t, l]) => `${t.toFixed(4)} ${l}`).join(' ')}\n`;
}

/** Mix down / up so a WAV has the channel count an effect expects ('mono'|'stereo'). */
export function conformChannels(wav, want) {
  const d = decodeAudio(wav);
  if (want === 'mono') {
    if (d.numChannels === 1) return wav;
    const mono = new Float32Array(d.length);
    for (let c = 0; c < d.numChannels; c++) for (let i = 0; i < d.length; i++) mono[i] += d.channelData[c][i] / d.numChannels;
    return encodeWav({ sampleRate: d.sampleRate, channelData: [mono] });
  }
  if (want === 'stereo') {
    if (d.numChannels === 2) return wav;
    const L = d.channelData[0];
    const R = d.numChannels > 1 ? d.channelData[1] : d.channelData[0].slice();
    return encodeWav({ sampleRate: d.sampleRate, channelData: [L, R] });
  }
  return wav;
}

/**
 * Resample a WAV to a target sample rate (linear interpolation) if it differs.
 * Used to match a second source to the first for two-input effects, since CDP's
 * morph/combine/formants/submix reject inputs whose sample rates don't match.
 */
export function conformRate(wav, targetRate) {
  const d = decodeAudio(wav);
  if (d.sampleRate === targetRate) return wav;
  const ratio = targetRate / d.sampleRate;
  const newLen = Math.max(1, Math.round(d.length * ratio));
  const channelData = d.channelData.map((ch) => {
    const out = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const pos = i / ratio;
      const i0 = Math.floor(pos);
      const a = ch[i0] || 0;
      const b = i0 + 1 < ch.length ? ch[i0 + 1] : a;
      out[i] = a + (b - a) * (pos - i0);
    }
    return out;
  });
  return encodeWav({ sampleRate: targetRate, channelData });
}
