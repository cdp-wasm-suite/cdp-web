// Effect entries for CDP's `tweet` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { derivePitch } from './helpers.js';

export default [
  // tweet: the pitch breakpoint file is DERIVED from the input (getpitch),
  // falling back to the 'pitch' hint — matching the usage text's own advice
  // ("Use repitch getpitch 2"). FOF extraction requires the pitch data to
  // track the source: a mismatched constant yields an empty output.
  {
    id: 'tweet.tweet', label: 'Tweets', category: 'Pitch-sync grains',
    program: 'tweet', domain: 'sound', input: 'mono', prefersHarmonic: true,
    derive: derivePitch, needs: ['pvoc', 'repitch'],
    // Mode 1: pkcnt (peaks per impulse; tweet frequency follows FOF size).
    // Mode 2 (fixed-frq) is NOT wrapped: it writes NaNs for any frq < 200 in
    // this build.
    args: ['tweet', '1', '$IN', '$OUT', '0', '$DATA', { p: 'minlevel' }, { p: 'pkcnt' }, { p: 'chirp' }],
    params: [
      { name: 'minlevel', label: 'Min level (dB)', min: -60, max: 0, default: 0, step: 1, help: 'Pulses this many dB quieter than the loudest one are left out. 0 keeps them all.' },
      { name: 'pkcnt', label: 'Peaks', min: 1, max: 200, default: 30, step: 1, help: 'How many wave-peaks each synthetic tweet contains. More peaks give a lower, longer chirp per pulse.' },
      { name: 'chirp', label: 'Chirp', min: 0, max: 30, default: 4, step: 1, help: 'How much each tweet glides in pitch. Higher is more birdlike; very high values can get loud.' },
      { name: 'pitch', label: 'Pitch hint (Hz)', min: 50, max: 2000, default: 220, step: 1, help: 'Fallback pitch used only if the source’s pitch can’t be detected automatically, in Hz.' },
    ],
    blurb: 'Replace the voiced pulses of the sound with synthetic birdsong-like tweets. Pitch is auto-detected; the hint is used if none is found.',
  },
  {
    id: 'tweet.noise', label: 'Pulses to noise', category: 'Pitch-sync grains',
    program: 'tweet', domain: 'sound', input: 'mono', prefersHarmonic: true,
    derive: derivePitch, needs: ['pvoc', 'repitch'],
    args: ['tweet', '3', '$IN', '$OUT', '0', '$DATA', { p: 'minlevel' }],
    params: [
      { name: 'minlevel', label: 'Min level (dB)', min: -60, max: 0, default: 0, step: 1, help: 'Pulses this many dB quieter than the loudest one are left out. 0 keeps them all.' },
      { name: 'pitch', label: 'Pitch hint (Hz)', min: 50, max: 2000, default: 220, step: 1, help: 'Fallback pitch used only if the source’s pitch can’t be detected automatically, in Hz.' },
    ],
    blurb: 'Replace the voiced pulses of the sound with bursts of noise (whispered/breathy version of the source).',
  },
];
