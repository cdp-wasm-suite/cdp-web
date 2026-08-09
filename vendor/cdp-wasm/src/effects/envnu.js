// Effect entries for CDP's `envnu` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'envnu.expdecay', label: 'Exponential decay', category: 'Envelope',
    program: 'envnu', domain: 'sound', mono: false,
    args: ['expdecay', '$IN', '$OUT', { p: 'starttime' }, { p: 'endtime' }],
    params: [
      { name: 'starttime', label: 'Start (s)', min: 0, max: 2, default: 0.2, step: 0.05, help: 'When the decay begins, in seconds from the start of the file.' },
      { name: 'endtime', label: 'End (s)', min: 0.5, max: 10, default: 10, step: 0.5, help: 'When the decay reaches silence. If earlier than the file end the output is cut there; at or beyond it, the decay lasts to the end of the file.' },
    ],
    blurb: 'Impose an exponential fade-to-silence from a chosen start time.',
  },
  {
    id: 'envnu.peakchop', label: 'Peak chop', category: 'Envelope',
    program: 'envnu', domain: 'sound', mono: false, prefersGrains: true,
    args: ['peakchop', '1', '$IN', '$OUT', { p: 'wsize' }, { p: 'pkwidth' }, { p: 'risetime' }, { p: 'tempo' }, { p: 'gain' }],
    params: [
      { name: 'wsize', label: 'Window (ms)', min: 10, max: 64, default: 50, step: 1, help: 'Window size used to find loudness peaks. Smaller windows find more, smaller peaks.' },
      { name: 'pkwidth', label: 'Peak width (ms)', min: 5, max: 100, default: 20, step: 1, help: 'Length of sound kept around each peak. Must stay shorter than the gap between peaks in the source.' },
      { name: 'risetime', label: 'Rise (ms)', min: 1, max: 50, default: 10, step: 1, help: 'Fade-in time from silence up to each peak, in milliseconds.' },
      { name: 'tempo', label: 'Tempo (per min)', min: 60, max: 600, default: 120, step: 5, help: 'Playback rate of the extracted peaks, in events per minute.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 1, default: 1, step: 0.05, help: 'Lower this if a fast tempo makes the replayed peaks overlap and clip.' },
    ],
    blurb: 'Isolate the attack peaks and replay them at a set tempo. Needs rhythmic input.',
  },
];
