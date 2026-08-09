// Generator entries for CDP's `synth` program (built-in waveshapes / noise /
// silence / spectra / chord). Entry shape: see the header comment in
// ../generators.js.

export default [
  { id: 'wave', label: 'Waveform', category: 'Synthesis', program: 'synth', mode: ['wave'],
    // -t4096 is synth's largest wavetable (default 256); the table is read with
    // linear interpolation, so the bigger table puts the interpolation error
    // below the output's own quantisation floor. Costs 32 KB, once.
    args: ['wave', { p: 'shape' }, '$OUT', '$SR', '1', { p: 'dur' }, { p: 'freq' }, { p: 'amp', flag: '-a' }, '-t4096'],
    params: [
      // synth's own mode names are misleading: mode 3 generates a triangle (it
      // ramps up, mirrors back down, then negates) and mode 4 the sawtooth.
      { name: 'shape', label: 'Waveform', choices: [['Sine', '1'], ['Square', '2'], ['Triangle', '3'], ['Sawtooth', '4']], default: '1' },
      { name: 'freq', label: 'Freq (Hz)', min: 20, max: 8000, default: 330, step: 1, env: true },
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 1.5, step: 0.1 },
      { name: 'amp', label: 'Amplitude', min: 0.05, max: 1, default: 0.8, step: 0.05, env: true },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#WAVE',
    blurb: 'Simple oscillator: sine, square, triangle or sawtooth. The non-sine shapes are not band-limited, so they alias at high frequencies.',
    notes: 'Two things below differ from what synth’s own usage says. It is rendered with the largest wavetable (-t4096), not the 256-point default; the table is read with linear interpolation either way, and the larger one puts the interpolation error below what the output format carries. And the shape names are corrected here: synth’s mode 3, which it calls a sawtooth, generates a triangle, and its mode 4 “ramp” is the sawtooth.' },
  { id: 'noise', label: 'White noise', category: 'Synthesis', program: 'synth', mode: ['noise'],
    args: ['noise', '$OUT', '$SR', '1', { p: 'dur' }, { p: 'amp', flag: '-a' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 1.5, step: 0.1 },
      { name: 'amp', label: 'Amplitude', min: 0.05, max: 1, default: 0.5, step: 0.05, env: true },
    ],
    parityExempt: 'rand()',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#NOISE',
    blurb: 'White noise.' },
  { id: 'silence', label: 'Silence', category: 'Synthesis', program: 'synth', mode: ['silence'],
    args: ['silence', '$OUT', '$SR', { p: 'chans' }, { p: 'dur' }],
    params: [
      { name: 'chans', label: 'Channels', choices: [['Mono', '1'], ['Stereo', '2'], ['Quad', '4']], default: '1' },
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 60, default: 1, step: 0.1 },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#SILENCE',
    blurb: 'A silent soundfile of any length — useful for splicing gaps between sounds.' },
  { id: 'spectra', label: 'Spectral band', category: 'Synthesis', program: 'synth', mode: ['spectra'],
    args: ['spectra', '$OUT', { p: 'dur' }, { p: 'frq' }, { p: 'spread' }, { p: 'maxfoc' }, { p: 'minfoc' }, { p: 'timevar' }, '$SR'],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 3, step: 0.1 },
      { name: 'frq', label: 'Centre freq (Hz)', min: 50, max: 8000, default: 440, step: 1 },
      { name: 'spread', label: 'Bandwidth (Hz)', min: 1, max: 4000, default: 300, step: 1 },
      { name: 'maxfoc', label: 'Max focus', min: 0, max: 1, default: 0.8, step: 0.05 },
      { name: 'minfoc', label: 'Min focus', min: 0, max: 1, default: 0.2, step: 0.05 },
      { name: 'timevar', label: 'Time variation', min: 0, max: 1, default: 0.5, step: 0.05 },
    ],
    parityExempt: 'rand()',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#SPECTRA',
    blurb: 'A warbled tone of varying pitch within a spectral band around a centre frequency.' },
  { id: 'chord', label: 'Chord', category: 'Synthesis', program: 'synth', mode: ['chord'],
    args: ['chord', { p: 'kind' }, '$OUT', '$DATA', '$SR', '1', { p: 'dur' }, { p: 'amp', flag: '-a' }],
    params: [
      { name: 'kind', label: 'Note data', choices: [['MIDI notes', '1'], ['Frequencies', '2']], default: '1' },
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'amp', label: 'Amplitude', min: 0.05, max: 1, default: 0.6, step: 0.05 },
    ],
    data: { label: 'Notes (one per line)', placeholder: 'MIDI notes, e.g. 60 / 64 / 67', default: '60\n64\n67\n71' },
    parityExempt: 'sine-sum FP differs across platforms',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#CHORD',
    blurb: 'Chord from a list of MIDI notes (or frequencies) on a sine wave.' },
];
