// Generator entries for CDP's `newsynth` program (additive / wave-packet /
// fractal / Duffing synthesis). Entry shape: see the header comment in
// ../generators.js.

export default [
  { id: 'addsynth', label: 'Additive synth', category: 'Synthesis', program: 'newsynth', mode: ['synthesis', '1'],
    args: ['synthesis', '1', '$OUT', '$DATA', '$SR', { p: 'dur' }, { p: 'frq' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Frequency', min: 1, max: 4000, default: 220, step: 1, env: true },
    ],
    data: { label: 'Spectrum: "time pno level pno level ..." (1st partial must be 1)',
      placeholder: 'e.g. 0 1 1 2 0.5 3 0.3', default: '0 1 1 2 0.5 3 0.333 4 0.25 5 0.2 6 0.167 7 0.143 8 0.125 9 0.111 10 0.1 11 0.091 12 0.083 13 0.077 14 0.071 15 0.067 16 0.063' },
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#NEWSYNTH',
    blurb: 'Additive synthesis from a user-defined (harmonic or inharmonic) spectrum of partials.' },
  { id: 'addsynth_packets', label: 'Wave-packet synth', category: 'Synthesis', program: 'newsynth', mode: ['synthesis', '2'],
    args: ['synthesis', '2', '$OUT', '$DATA', '$SR', { p: 'dur' }, { p: 'frq' }, { p: 'narrowing', flag: '-n' }, { p: 'centring', flag: '-c' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Frequency', min: 1, max: 4000, default: 220, step: 1, env: true },
      { name: 'narrowing', label: 'Packet narrowing', min: 0, max: 1000, default: 1, step: 0.5 },
      { name: 'centring', label: 'Peak centring', min: -1, max: 1, default: 0, step: 0.1 },
    ],
    data: { label: 'Spectrum: "time pno level pno level ..." (1st partial must be 1)',
      placeholder: 'e.g. 0 1 1 2 0.5 3 0.3', default: '0 1 1 2 0.5 3 0.333 4 0.25 5 0.2 6 0.167 7 0.143 8 0.125 9 0.111 10 0.1 11 0.091 12 0.083 13 0.077 14 0.071 15 0.067 16 0.063' },
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#NEWSYNTH',
    blurb: 'Streams of enveloped wave-packets built from a user-defined spectrum.' },
  { id: 'fractal', label: 'Fractal synth', category: 'Synthesis', program: 'newsynth', mode: ['synthesis', '4'],
    args: ['synthesis', '4', '$OUT', '$SR', { p: 'dur' }, { p: 'frq' }, { p: 'atk' }, { p: 'ea' }, { p: 'dec' }, { p: 'ed' }, { p: 'atoh' }, { p: 'gtow' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Frequency', min: 1, max: 4000, default: 220, step: 1, env: true },
      { name: 'atk', label: 'Spike attack (samps)', min: 1, max: 16, default: 4, step: 1 },
      { name: 'ea', label: 'Attack curve', min: 0.3, max: 4, default: 1, step: 0.1 },
      { name: 'dec', label: 'Spike decay (samps)', min: 1, max: 64, default: 20, step: 1 },
      { name: 'ed', label: 'Decay curve', min: 0.3, max: 4, default: 1, step: 0.1 },
      { name: 'atoh', label: 'On/off ratio', min: 0.1, max: 1, default: 0.5, step: 0.05, env: true },
      { name: 'gtow', label: 'Group/wave ratio', min: 0.1, max: 1, default: 0.5, step: 0.05, env: true },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#NEWSYNTH',
    blurb: 'A buzzy tone made of spikes distributed fractally over the wavelength.' },
  { id: 'duffing', label: 'Duffing oscillator', category: 'Synthesis', program: 'newsynth', mode: ['synthesis', '5'],
    args: ['synthesis', '5', '$OUT', '$SR', { p: 'dur' }, { p: 'frq' }, { p: 'damping' }, { p: 'k' }, { p: 'b' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Forcing freq (Hz)', min: 1, max: 200, default: 80, step: 1, env: true },
      { name: 'damping', label: 'Damping', min: 0.15, max: 2, default: 0.5, step: 0.05, env: true },
      { name: 'k', label: 'k coefficient', min: -10, max: 10, default: 1, step: 0.1 },
      { name: 'b', label: 'b coefficient', min: 20, max: 50, default: 30, step: 1 },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#NEWSYNTH',
    blurb: 'An experimental Duffing damped oscillator.' },
];
