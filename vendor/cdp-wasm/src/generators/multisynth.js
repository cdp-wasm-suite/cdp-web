// Generator entry for CDP's `multisynth` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  { id: 'multisynth', label: 'Multisynth (score)', category: 'Synthesis', program: 'multisynth', mode: ['synth'],
    args: ['synth', '$OUT', '$DATA', { p: 'mm' }, { p: 'jitter', flag: '-j' }],
    params: [
      { name: 'mm', label: 'Tempo (MM)', min: 30, max: 300, default: 120, step: 1 },
      { name: 'jitter', label: 'Timing jitter (ms)', min: 0, max: 20, default: 15, step: 1 },
    ],
    // Times/durations are integers in thirds-of-semiquavers; durations must be
    // multiples of 3 or 4 (CDP rejects others).
    data: { label: 'Score: "Insname time pitch loud dur ..." (times/durs in thirds-of-semiquavers; dur = multiple of 3 or 4)',
      placeholder: 'flute 0 60 0.8 24 24 64 0.8 24',
      default: 'flute 0 60 0.8 24 24 64 0.8 24 48 67 0.8 24' },
    // The native multisynth binary crashes (heap "corrupted size") on this score,
    // so there's no native side to compare — skip parity (WASM output is fine).
    paritySkip: true,
    parityExempt: 'rand()',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#MULTISYNTH',
    notes: 'Always renders at 44100 Hz — multisynth hard-codes its output rate (MSYNSRATE) with no option to set it, so this generator ignores the session sample rate.',
    blurb: 'Triggers and mixes a small set of built-in instrument sounds from a score (low-fi).' },
];
