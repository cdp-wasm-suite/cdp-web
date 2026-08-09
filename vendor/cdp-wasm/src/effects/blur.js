// Effect entries for CDP's `blur` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'blur.blur', label: 'Spectral blur', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    args: ['blur', '$IN', '$OUT', { p: 'windows' }],
    params: [{ name: 'windows', label: 'Windows', min: 1, max: 100, default: 10, step: 1, help: 'How many successive analysis frames are averaged together. Higher smears the sound more, softening transients.' }],
    blurb: 'Time-average the spectrum over N analysis windows.',
  },
  {
    id: 'blur.avrg', label: 'Spectral average', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    args: ['avrg', '$IN', '$OUT', { p: 'neighbours' }],
    params: [{ name: 'neighbours', label: 'Neighbours', min: 2, max: 50, default: 4, step: 1, help: 'How many adjacent frequency bands each band is averaged with. Higher blends the spectrum into a smoother, more diffuse timbre.' }],
    blurb: 'Average each spectral band with its frequency neighbours.',
  },
  {
    id: 'blur.suppress', label: 'Suppress partials', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    args: ['suppress', '$IN', '$OUT', { p: 'partials' }],
    params: [{ name: 'partials', label: 'Suppress N loudest', min: 1, max: 30, default: 3, step: 1, help: 'How many of the strongest partials to remove from each frame — strips out the most prominent tones.' }],
    blurb: 'Remove the N loudest partials in each window.',
  },
  {
    id: 'blur.chorus', label: 'Spectral chorus', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    parityExempt: 'randomises partials (rand)',
    args: ['chorus', '5', '$IN', '$OUT', { p: 'aspread' }, { p: 'fspread' }],
    params: [
      { name: 'aspread', label: 'Amp scatter', min: 1, max: 1028, default: 200, step: 1, help: 'How widely the partials’ loudnesses are randomly scattered. Higher gives a richer, more diffuse chorus.' },
      { name: 'fspread', label: 'Freq scatter', min: 1, max: 4, default: 2, step: 0.1, help: 'How widely the partials’ frequencies are detuned. Higher thickens and blurs the pitch.' },
    ],
    blurb: 'Chorus by randomising partial amplitudes and frequencies.',
  },
  {
    id: 'blur.drunk', label: 'Drunk walk', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    parityExempt: 'random walk (rand)',
    args: ['drunk', '$IN', '$OUT', { p: 'range' }, '0', { p: 'dur' }],
    params: [
      { name: 'range', label: 'Step range', min: 1, max: 50, default: 5, step: 1, help: 'Biggest jump the random walk can take between analysis frames. Higher wanders more wildly through the sound.' },
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 8, default: 2, step: 0.5, help: 'Length of the output, in seconds.' },
    ],
    blurb: 'Read the spectrum by a random (drunken) walk over analysis windows.',
  },
  {
    id: 'blur.shuffle', label: 'Shuffle windows', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    args: ['shuffle', '$IN', '$OUT', 'abcd-aabbccdd', { p: 'grpsize' }],
    params: [{ name: 'grpsize', label: 'Group size', min: 1, max: 20, default: 1, step: 1, help: 'How many analysis frames are treated as one unit before the shuffle pattern is applied. Larger groups repeat bigger chunks.' }],
    blurb: 'Shuffle the order of spectral analysis windows by a domain→image pattern.',
  },
  {
    id: 'blur.noise', label: 'Spectral noise', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    parityExempt: 'injects random noise (rand)',
    args: ['noise', '$IN', '$OUT', { p: 'noise' }],
    params: [{ name: 'noise', label: 'Noise', min: 0, max: 1, default: 0.5, step: 0.05, help: 'How much noise is mixed into the spectrum: 0 leaves it clean, 1 fully saturates it into a noisy wash.' }],
    blurb: 'Inject noise into the spectrum (0 = none, 1 = saturated).',
  },
  {
    id: 'blur.scatter', label: 'Spectral scatter', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    parityExempt: 'randomly thins spectrum (rand)',
    args: ['scatter', '$IN', '$OUT', { p: 'keep' }],
    params: [{ name: 'keep', label: 'Blocks kept', min: 1, max: 32, default: 4, step: 1, help: 'How many spectral blocks survive in each frame; the rest are dropped at random. Fewer thins the sound more drastically.' }],
    blurb: 'Randomly thin the spectrum, keeping N blocks per window.',
  },
  {
    id: 'blur.spread', label: 'Spread peaks', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    parityExempt: 'introduces random noisiness (rand)',
    args: ['spread', '$IN', '$OUT', '-f16', { p: 'spread', flag: '-s' }],
    params: [{ name: 'spread', label: 'Spread', min: 0, max: 1, default: 1, step: 0.05, help: 'How far the spectral peaks are smeared sideways. Higher widens each peak, adding controlled noisiness.' }],
    blurb: 'Spread the spectral peaks, introducing controlled noisiness.',
  },
  {
    id: 'blur.weave', label: 'Weave windows', category: 'Spectral',
    program: 'blur', domain: 'spectral', mono: false,
    // weavfile: integer steps (in analysis windows) through the file, repeated to
    // the end. The pattern must never step back before its own start window, so a
    // forward bias (two forward steps then a smaller back step) keeps it legal.
    args: ['weave', '$IN', '$OUT', '$DATA'],
    data: (v) => `${v.fwd}\n${v.fwd}\n-${v.back}\n`,
    params: [
      { name: 'fwd', label: 'Forward step', min: 2, max: 20, default: 3, step: 1, help: 'How many analysis windows each forward hop advances.' },
      { name: 'back', label: 'Back step', min: 0, max: 19, default: 2, step: 1, maxOf: (v) => 2 * Number(v.fwd) - 1, help: 'How many windows the periodic back-hop retreats. Keep below the forward step so the weave keeps moving ahead (a stuttering, woven read).' },
    ],
    blurb: 'Read the spectrum by weaving forward and back through the analysis windows.',
  },
];
