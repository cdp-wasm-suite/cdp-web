// Effect entries for CDP's `repitch` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { pitchDataPipeline, majorScale } from './helpers.js';

export default [
  {
    id: 'repitch.transpose', label: 'Transpose spectrum', category: 'Spectral pitch',
    program: 'repitch', domain: 'spectral', mono: false,
    args: ['transpose', '3', '$IN', '$OUT', { p: 'semitones' }],
    params: [{ name: 'semitones', label: 'Semitones', min: -24, max: 24, default: 5, step: 1, help: 'How far to transpose the whole spectrum, in semitones. The formants move with the pitch, so it can sound chipmunk-like at large shifts. ±12 = one octave.' }],
    blurb: 'Transpose the spectrum (the spectral envelope moves with it).',
  },
  // Detect the pitch contour, transform it, and re-apply it (formant-preserved).
  // Needs a clearly-pitched monophonic source; unpitched input passes through.
  {
    id: 'repitch.quantise', label: 'Quantise pitch (autotune)', category: 'Pitch-data',
    program: 'repitch', domain: 'sound', needs: ['pvoc'], cdpDoc: 'REPITCH QUANTISE',
    pipeline: (cdp, src, v) => pitchDataPipeline(cdp, src, v, {
      args: () => ['quantise', '2', '/p.frq', '/t.trn', '/q.txt', '-o'],
      qset: (v) => majorScale(v.root),
    }),
    params: [{ name: 'root', label: 'Key root (MIDI)', min: 48, max: 71, default: 60, step: 1, help: 'Root note of the major scale the pitch is snapped to (MIDI note; 60 = middle C / C4).' }],
    blurb: 'Snap the detected pitch to a major scale (autotune), preserving formants. Needs a pitched, monophonic source.',
  },
  {
    id: 'repitch.smooth', label: 'Smooth pitch (de-vibrato)', category: 'Pitch-data',
    program: 'repitch', domain: 'sound', needs: ['pvoc'], cdpDoc: 'REPITCH SMOOTH',
    pipeline: (cdp, src, v) => pitchDataPipeline(cdp, src, v, {
      args: (v) => ['smooth', '2', '/p.frq', '/t.trn', String(v.timeframe)],
    }),
    params: [{ name: 'timeframe', label: 'Smooth (ms)', min: 10, max: 1000, default: 200, step: 10, help: 'Window over which the pitch contour is averaged, in milliseconds. Larger removes more vibrato and jitter, flattening the melody.' }],
    blurb: 'Smooth the detected pitch contour over a time window (removes vibrato/jitter). Needs a pitched source.',
  },
  {
    id: 'repitch.invert', label: 'Invert pitch contour', category: 'Pitch-data',
    program: 'repitch', domain: 'sound', needs: ['pvoc'], cdpDoc: 'REPITCH INVERT',
    pipeline: (cdp, src, v) => pitchDataPipeline(cdp, src, v, {
      args: (v) => ['invert', '2', '/p.frq', '/t.trn', '0', '-m' + v.mean],
    }),
    params: [{ name: 'mean', label: 'Pivot (MIDI)', min: 36, max: 84, default: 60, step: 1, help: 'Pitch the melody is mirrored around (MIDI note; 60 = middle C). Notes above the pivot flip below it and vice versa.' }],
    blurb: 'Mirror the detected pitch contour around a pivot pitch (melodic inversion). Needs a pitched source.',
  },
];
