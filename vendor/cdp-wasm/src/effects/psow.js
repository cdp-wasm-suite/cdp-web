// Effect entries for CDP's `psow` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { derivePitch } from './helpers.js';

export default [
  // The pitch breakpoint file is DERIVED from the input (pvoc anal -> getpitch),
  // falling back to the 'pitch' hint when the source isn't clearly pitched.
  {
    id: 'psow.stretch', label: 'Pitch-sync stretch', category: 'Pitch-sync grains',
    program: 'psow', domain: 'sound', input: 'mono',
    derive: derivePitch, needs: ['pvoc', 'repitch'],
    args: ['stretch', '$IN', '$OUT', '$DATA', { p: 'stretch' }, { p: 'segcnt' }],
    params: [
      { name: 'stretch', label: 'Stretch ×', min: 0.25, max: 4, default: 2, step: 0.25, help: 'How much longer to make the sound. 2 is twice as long, 0.5 half. The pitch is preserved.' },
      { name: 'segcnt', label: 'Grains/chunk', min: 1, max: 16, default: 4, step: 1, help: 'How many pitch-synchronous grains are grouped per chunk. Affects how grainy the stretch sounds.' },
      { name: 'pitch', label: 'Pitch hint (Hz)', min: 50, max: 2000, default: 220, step: 1, help: 'Fallback pitch used only if the source’s pitch can’t be detected automatically, in Hz.' },
    ],
    blurb: 'Time-stretch by repositioning pitch-synchronous grains. Pitch is auto-detected; the hint is used if none is found.',
  },
  {
    id: 'psow.dupl', label: 'Pitch-sync duplicate', category: 'Pitch-sync grains',
    program: 'psow', domain: 'sound', input: 'mono',
    derive: derivePitch, needs: ['pvoc', 'repitch'],
    args: ['dupl', '$IN', '$OUT', '$DATA', { p: 'repeats' }, { p: 'segcnt' }],
    params: [
      { name: 'repeats', label: 'Repeats', min: 2, max: 8, default: 3, step: 1, help: 'How many times each pitch-synchronous grain is duplicated, lengthening the sound while holding its pitch.' },
      { name: 'segcnt', label: 'Grains/chunk', min: 1, max: 16, default: 4, step: 1, help: 'How many pitch-synchronous grains are grouped per chunk.' },
      { name: 'pitch', label: 'Pitch hint (Hz)', min: 50, max: 2000, default: 220, step: 1, help: 'Fallback pitch used only if the source’s pitch can’t be detected automatically, in Hz.' },
    ],
    blurb: 'Lengthen by duplicating pitch-synchronous grains. Pitch is auto-detected; the hint is used if none is found.',
  },
  {
    id: 'psow.sustain', label: 'Freeze grain (sustain)', category: 'Pitch-sync grains',
    program: 'psow', domain: 'sound', input: 'mono',
    args: ['sustain2', '$IN', '$OUT', { p: 'start' }, { p: 'end' }, { p: 'dur' }, { p: 'vibfrq' }, { p: 'vibdepth' }, { p: 'nudge' }],
    params: [
      { name: 'start', label: 'Grain start (s)', min: 0, max: 60, default: 0.2, step: 0.05, help: 'Time at which the sustained grain is cut from the source, in seconds.' },
      { name: 'end', label: 'Grain end (s)', min: 0.05, max: 60, default: 0.4, step: 0.05, help: 'End time of the grain in the source, in seconds.' },
      { name: 'dur', label: 'Output (s)', min: 0.5, max: 20, default: 3, step: 0.5, help: 'Length of the sustained output, in seconds (longer than the input).' },
      { name: 'vibfrq', label: 'Vibrato (Hz)', min: 0, max: 20, default: 5, step: 0.5, help: 'Rate of an added vibrato, in Hz. 0 for none.' },
      { name: 'vibdepth', label: 'Vib depth (st)', min: 0, max: 4, default: 0.3, step: 0.05, help: 'Depth of the added vibrato, in semitones.' },
      { name: 'nudge', label: 'Nudge', min: 0, max: 50, default: 0, step: 1, help: 'Shift the chosen grain position by this many zero-crossings.' },
    ],
    blurb: 'Freeze and sustain a single grain into a held tone, with optional vibrato.',
  },
];
