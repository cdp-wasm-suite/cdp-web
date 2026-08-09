// Generator entry for CDP's `impulse` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  { id: 'impulse', label: 'Impulse train', category: 'Synthesis', program: 'impulse', mode: ['impulse'],
    // impulse takes its output rate as an option, not a positional (default
    // 44100) — without '-s$SR' it ignores the session rate entirely.
    args: ['impulse', '$OUT', { p: 'dur' }, { p: 'pitch' }, { p: 'chirp' }, { p: 'slope' }, { p: 'pkcnt' }, { p: 'level' }, '-s$SR'],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'pitch', label: 'Pitch (MIDI)', min: 24, max: 96, default: 48, step: 1, env: true },
      { name: 'chirp', label: 'Chirp', min: 0, max: 30, default: 0, step: 1, env: true },
      { name: 'slope', label: 'Slope', min: 1, max: 20, default: 5, step: 1, env: true },
      { name: 'pkcnt', label: 'Peaks', min: 1, max: 32, default: 4, step: 1 },
      { name: 'level', label: 'Level', min: 0.05, max: 1, default: 0.8, step: 0.05, env: true },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#IMPULSE',
    blurb: 'Stream of impulses — good for driving grain effects.' },
];
