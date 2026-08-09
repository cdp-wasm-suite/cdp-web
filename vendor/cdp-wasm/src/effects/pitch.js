// Effect entries for CDP's `pitch` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { pitchFromAnalysis } from './helpers.js';

export default [
  {
    id: 'pitch.transp', label: 'Transpose part of spectrum', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', mono: false,
    args: ['transp', '4', '$IN', '$OUT', { p: 'split' }, { p: 'semitones' }],
    params: [
      { name: 'split', label: 'Split (Hz)', min: 100, max: 6000, default: 1000, step: 50, help: 'Only the spectrum above this frequency is transposed; below it is left alone.' },
      { name: 'semitones', label: 'Semitones', min: -24, max: 24, default: 7, step: 1, help: 'How far to transpose the upper part of the spectrum, in semitones. ±12 = one octave.' },
    ],
    blurb: 'Transpose only the part of the spectrum above a split frequency.',
  },
  {
    id: 'pitch.pick', label: 'Pick harmonics', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', mono: false,
    args: ['pick', '1', '$IN', '$OUT', { p: 'fundamental' }, { p: 'clarity', flag: '-c' }],
    params: [
      { name: 'fundamental', label: 'Fundamental (Hz)', min: 20, max: 4000, default: 220, step: 1, help: 'Fundamental frequency whose harmonic series is kept; energy off the harmonics is suppressed.' },
      { name: 'clarity', label: 'Clarity', min: 0, max: 1, default: 1, step: 0.05, help: 'How strongly off-harmonic channels are suppressed. 1 is the cleanest sieve; lower leaves more of the original.' },
    ],
    blurb: 'Keep only the spectral channels near the harmonics of a fundamental (pitch sieve).',
  },
  {
    id: 'pitch.tune', label: 'Tune to pitch', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', mono: false,
    args: ['tune', '2', '$IN', '$OUT', { p: 'midi' }, { p: 'clarity', flag: '-c' }],
    params: [
      { name: 'midi', label: 'Target (MIDI)', min: 24, max: 96, default: 48, step: 1, help: 'Pitch whose harmonic series the spectrum is retuned to (MIDI note; 48 = C3, 60 = middle C).' },
      { name: 'clarity', label: 'Clarity', min: 0, max: 1, default: 0.5, step: 0.05, help: 'How strongly off-harmonic partials are suppressed. Higher gives a purer, more clearly pitched tone.' },
    ],
    blurb: 'Replace the spectral frequencies with harmonics of a target pitch (spectral retuning).',
  },
  {
    id: 'pitch.chord', label: 'Spectral chord', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', mono: false,
    args: ['chord', '$IN', '$OUT', '$DATA'],
    // transpose_file: one (possibly fractional) semitone transposition per line;
    // each adds a transposed copy of the spectrum superimposed on the original.
    data: (v) => `${v.v1}\n${v.v2}\n${v.v3}\n`,
    params: [
      { name: 'v1', label: 'Voice 1 (semis)', min: -24, max: 24, default: 4, step: 1, help: 'Transposition of the first added voice, in semitones above (or below) the original. 4 = a major third.' },
      { name: 'v2', label: 'Voice 2 (semis)', min: -24, max: 24, default: 7, step: 1, help: 'Transposition of the second added voice, in semitones. 7 = a fifth.' },
      { name: 'v3', label: 'Voice 3 (semis)', min: -24, max: 24, default: 12, step: 1, help: 'Transposition of the third added voice, in semitones. 12 = an octave.' },
    ],
    blurb: 'Superimpose transposed copies of the spectrum on the original, building a chord.',
  },
  {
    id: 'pitch.octmove', label: 'Octave up (keep formants)', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', needs: ['pvoc', 'repitch'], cdpDoc: 'PITCH OCTMOVE',
    pipeline: (cdp, src, v) => pitchFromAnalysis(cdp, src, ['octmove', '1', '$ANA', '$PFRQ', '$OUT', String(v.ratio)]),
    params: [{ name: 'ratio', label: 'Interval ratio', min: 2, max: 8, default: 2, step: 1, help: 'Harmonic-series transposition ratio: 2 = an octave up, 3 = an octave-and-a-fifth, 4 = two octaves. The formants stay put, so it doesn’t sound chipmunk-like. Needs a pitched, monophonic source.' }],
    blurb: 'Transpose up by an octave (or harmonic ratio) without shifting the formants. Needs a pitched source.',
  },
  {
    id: 'pitch.octmovedn', label: 'Octave down (keep formants)', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', needs: ['pvoc', 'repitch'], cdpDoc: 'PITCH OCTMOVE',
    pipeline: (cdp, src, v) => pitchFromAnalysis(cdp, src, ['octmove', '2', '$ANA', '$PFRQ', '$OUT', String(v.ratio)]),
    params: [{ name: 'ratio', label: 'Interval ratio', min: 2, max: 8, default: 2, step: 1, help: 'Harmonic-series transposition ratio: 2 = an octave down, 3 = an octave-and-a-fifth, 4 = two octaves. The formants stay put, giving a deep, undersized-but-not-boomy drop. Needs a pitched, monophonic source.' }],
    blurb: 'Transpose down by an octave (or harmonic ratio) without shifting the formants. Needs a pitched source.',
  },
  {
    id: 'pitch.altharms', label: 'Delete alternate harmonics', category: 'Spectral pitch',
    program: 'pitch', domain: 'spectral', needs: ['pvoc', 'repitch'], cdpDoc: 'PITCH ALTHARMS',
    // mode 1 deletes odd harmonics — usually an octave-up transposition with no
    // formant change. No extra parameters beyond the derived pitchfile.
    pipeline: (cdp, src) => pitchFromAnalysis(cdp, src, ['altharms', '1', '$ANA', '$PFRQ', '$OUT']),
    params: [],
    blurb: 'Delete the odd harmonics — an octave-up transposition with no formant change (hollow, clarinet-like). Needs a pitched source.',
  },
];
