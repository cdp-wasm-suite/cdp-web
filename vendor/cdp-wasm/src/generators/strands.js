// Generator entry for CDP's `strands` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  // No docUrl: strands has no section in the CDP HTML reference (neither the
  // Release 8 zip nor the live site's index mentions it).
  // Mode 2 synthesises the combined sound. The pitch-tessitura (bot..top) is
  // split into `bands` of `threads` pitch-lines that spiral around one another
  // when `twist` is non-zero. The vortex-waviness (vamp/vmin/vmax) is fixed to a
  // gentle default; `rand`/`scat` likewise. strands numbers its output (out0.wav).
  { id: 'strands', label: 'Strands (pitch spiral)', category: 'Synthesis', program: 'strands', mode: ['strands', '2'],
    args: ['strands', '2', '$OUT', { p: 'dur' }, { p: 'bands' }, { p: 'threads' }, { p: 'tstep' },
      { p: 'bot' }, { p: 'top' }, { p: 'twist' }, '0.1', '0.1', '0.5', '0.1', '0.9', { p: 'turb' }, { p: 'seed' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 20, default: 4, step: 0.5 },
      { name: 'bands', label: 'Bands', min: 1, max: 4, default: 2, step: 1 },
      { name: 'threads', label: 'Threads/band', min: 2, max: 8, default: 4, step: 1 },
      { name: 'tstep', label: 'Time step (ms)', min: 1, max: 200, default: 20, step: 1 },
      { name: 'bot', label: 'Lowest pitch (MIDI)', min: 12, max: 60, default: 36, step: 1 },
      { name: 'top', label: 'Highest pitch (MIDI)', min: 60, max: 108, default: 96, step: 1 },
      { name: 'twist', label: 'Twist rate (Hz)', min: 0, max: 4, default: 0.5, step: 0.1 },
      { name: 'turb', label: 'Turbulence', min: 0, max: 2, default: 0.1, step: 0.05 },
      { name: 'seed', label: 'Seed', min: 1, max: 99, default: 1, step: 1 },
    ],
    // strands numbers its output (out.wav -> out0.wav); the parity harness reads
    // the exact output path, so skip the native comparison (rand()-driven anyway).
    paritySkip: true,
    parityExempt: 'rand()',
    notes: 'Always renders at 44100 Hz — strands hard-codes its output rate (STRAND_SRATE) with no option to set it, so this generator ignores the session sample rate.',
    blurb: 'Spiralling pitch-stream texture: bands of threads cycling around one another in pitch.' },
];
