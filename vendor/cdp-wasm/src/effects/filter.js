// Effect entries for CDP's `filter` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'filter.lohi', label: 'Low-pass filter', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['lohi', '1', '$IN', '$OUT', '-90', { p: 'passband' }, { p: 'stopband' }],
    params: [
      { name: 'passband', label: 'Pass band (Hz)', min: 100, max: 8000, default: 1500, step: 50, help: 'Frequencies below this pass through untouched.' },
      { name: 'stopband', label: 'Stop band (Hz)', min: 200, max: 16000, default: 3000, step: 50, help: 'Frequencies above this are removed. The rolloff falls across the gap between pass and stop bands — a wider gap is gentler.' },
    ],
    blurb: 'Fixed low-pass: frequencies above the stop band are removed.',
  },
  {
    id: 'filter.fixed', label: 'Boost/cut band', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['fixed', '3', '$IN', '$OUT', { p: 'bwidth' }, { p: 'boost' }, { p: 'freq' }],
    params: [
      { name: 'bwidth', label: 'Bandwidth (Hz)', min: 50, max: 4000, default: 500, step: 50, help: 'Width of the affected band, in Hz. Narrower targets a more specific region.' },
      { name: 'boost', label: 'Boost/cut (dB)', min: -24, max: 24, default: 6, step: 1, help: 'Amount of gain change in the band: positive boosts, negative cuts.' },
      { name: 'freq', label: 'Centre (Hz)', min: 100, max: 8000, default: 1000, step: 50, help: 'Centre frequency of the band, in Hz.' },
    ],
    blurb: 'Boost or cut a band of frequencies centred on a frequency.',
  },
  {
    id: 'filter.sweeping', label: 'Sweeping band-pass', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['sweeping', '2', '$IN', '$OUT', { p: 'acuity' }, { p: 'gain' }, { p: 'lofrq' }, { p: 'hifrq' }, { p: 'rate' }],
    params: [
      { name: 'acuity', label: 'Acuity', min: 0.001, max: 1, default: 0.1, step: 0.001, help: 'Sharpness of the band. Smaller values make a narrower, more resonant, whistlier filter.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Output level of the filtered signal.' },
      { name: 'lofrq', label: 'Low (Hz)', min: 50, max: 4000, default: 300, step: 50, help: 'Bottom of the frequency range the filter sweeps through.' },
      { name: 'hifrq', label: 'High (Hz)', min: 200, max: 12000, default: 4000, step: 50, help: 'Top of the frequency range the filter sweeps through.' },
      { name: 'rate', label: 'Sweep (Hz)', min: 0.1, max: 10, default: 2, step: 0.1, help: 'How fast the filter sweeps up and down the range, in sweeps per second.' },
    ],
    blurb: 'Band-pass filter whose focus frequency sweeps up and down a range.',
  },
  {
    id: 'filter.bandpass', label: 'Resonant band-pass', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['variable', '2', '$IN', '$OUT', { p: 'acuity' }, { p: 'gain' }, { p: 'freq' }],
    params: [
      { name: 'freq', label: 'Centre (Hz)', min: 50, max: 12000, default: 800, step: 10, help: 'Centre frequency the filter resonates at, in Hz. Can be swept with an envelope.' },
      { name: 'acuity', label: 'Resonance', min: 0.001, max: 1, default: 0.05, step: 0.001, help: 'Sharpness of the band. Smaller values are tighter and more resonant (whistlier); 1 is broad.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Output level. Tight (low-resonance) settings ring loudly, so reduce gain to avoid clipping.' },
    ],
    blurb: 'Resonant band-pass: passes a band around the centre frequency, the rest attenuated.',
  },
  {
    id: 'filter.notch', label: 'Resonant notch', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['variable', '1', '$IN', '$OUT', { p: 'acuity' }, { p: 'gain' }, { p: 'freq' }],
    params: [
      { name: 'freq', label: 'Centre (Hz)', min: 50, max: 12000, default: 800, step: 10, help: 'Centre frequency of the rejected band, in Hz. Can be swept with an envelope.' },
      { name: 'acuity', label: 'Resonance', min: 0.001, max: 1, default: 0.05, step: 0.001, help: 'Width of the notch. Smaller values cut a narrower, sharper band; 1 is broad.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Output level of the filtered signal.' },
    ],
    blurb: 'Resonant notch (band-reject): removes a band around the centre frequency.',
  },
  {
    id: 'filter.resonlo', label: 'Resonant low-pass', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['variable', '3', '$IN', '$OUT', { p: 'acuity' }, { p: 'gain' }, { p: 'freq' }],
    params: [
      { name: 'freq', label: 'Cutoff (Hz)', min: 50, max: 12000, default: 1200, step: 10, help: 'Cutoff frequency, in Hz. Frequencies above are attenuated; can be swept with an envelope.' },
      { name: 'acuity', label: 'Resonance', min: 0.001, max: 1, default: 0.1, step: 0.001, help: 'Resonance at the cutoff. Smaller values emphasise the cutoff more (a peak); 1 is a smooth rolloff.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Output level. Strong resonance rings loudly, so reduce gain to avoid clipping.' },
    ],
    blurb: 'Resonant low-pass with an emphasised cutoff (synth-style).',
  },
  {
    id: 'filter.resonhi', label: 'Resonant high-pass', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['variable', '4', '$IN', '$OUT', { p: 'acuity' }, { p: 'gain' }, { p: 'freq' }],
    params: [
      { name: 'freq', label: 'Cutoff (Hz)', min: 50, max: 12000, default: 800, step: 10, help: 'Cutoff frequency, in Hz. Frequencies below are attenuated; can be swept with an envelope.' },
      { name: 'acuity', label: 'Resonance', min: 0.001, max: 1, default: 0.1, step: 0.001, help: 'Resonance at the cutoff. Smaller values emphasise the cutoff more (a peak); 1 is a smooth rolloff.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Output level. Strong resonance rings loudly, so reduce gain to avoid clipping.' },
    ],
    blurb: 'Resonant high-pass with an emphasised cutoff (synth-style).',
  },
  {
    id: 'filter.phasing', label: 'Phaser', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['phasing', '2', '$IN', '$OUT', { p: 'gain' }, { p: 'delay' }],
    params: [
      { name: 'gain', label: 'Depth', min: -1, max: 0.95, default: 0.7, step: 0.05, help: 'Strength of the phasing notches. Higher (toward ±1) gives a deeper, more obvious sweep.' },
      { name: 'delay', label: 'Delay (ms)', min: 0.1, max: 20, default: 5, step: 0.1, help: 'Phase-shift delay in milliseconds; sets where the notches sit in the spectrum.' },
    ],
    blurb: 'Classic phasing effect (mix of signal with a phase-shifted copy).',
  },
  {
    id: 'filter.iterated', label: 'Iterated filter bank', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: true,
    // mode 2: filter pitches as MIDI; build a major triad over the root. Each
    // iteration re-enters the filterbank, so the output is longer than the input.
    args: ['iterated', '2', '$IN', '$OUT', '$DATA', { p: 'q' }, '1', { p: 'delay' }, { p: 'dur' }],
    data: (v) => `${v.root} 1\n${v.root + 4} 1\n${v.root + 7} 1\n`,
    params: [
      { name: 'root', label: 'Root (MIDI)', min: 24, max: 84, default: 48, step: 1, help: 'Root note of the major triad the filter bank is tuned to (MIDI note; 48 = C3, 60 = middle C).' },
      { name: 'q', label: 'Q (tightness)', min: 1, max: 200, default: 50, step: 1, help: 'Resonance of each filter. Higher rings more sharply, pulling out clearer pitched tones.' },
      { name: 'delay', label: 'Iteration gap (s)', min: 0.02, max: 2, default: 0.15, step: 0.01, help: 'Average delay between successive filtered re-soundings, in seconds.' },
      { name: 'dur', label: 'Output (s)', min: 1, max: 8, default: 3, step: 0.5, help: 'Minimum length of the iterated output, in seconds (longer than the source).' },
    ],
    blurb: 'Iterate the sound, cumulatively filtering each repeat through a tuned filter bank.',
  },
  // ==========================================================================
  // Phase D — effects that read a text data file, generated from the params
  // (referenced as '$DATA'). filter.bank needs none (it builds the series itself).
  // ==========================================================================
  {
    id: 'filter.bank', label: 'Harmonic filter bank', category: 'Filter & dynamics',
    program: 'filter', domain: 'sound', mono: false,
    args: ['bank', '1', '$IN', '$OUT', { p: 'q' }, '1', { p: 'lof' }, { p: 'hif' }],
    params: [
      { name: 'q', label: 'Q (tightness)', min: 0.5, max: 200, default: 20, step: 0.5, help: 'Resonance of each filter in the bank. Higher rings more sharply, pulling out clear pitched tones.' },
      { name: 'lof', label: 'Root (Hz)', min: 50, max: 2000, default: 200, step: 10, help: 'Fundamental of the harmonic series the filters are tuned to, in Hz.' },
      { name: 'hif', label: 'Top (Hz)', min: 1000, max: 12000, default: 8000, step: 100, help: 'Highest harmonic included, in Hz. Higher adds more filters up the series.' },
    ],
    blurb: 'A bank of resonant filters tuned to a harmonic series over the root frequency.',
  },
];
