// Effect entry for CDP's `subtract` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // `subtract` sample-subtracts a MONO 2nd input from one channel of the 1st
    // (identical inputs null to silence). CDP rejects a non-mono 2nd file, so
    // the entry carries `in2: 'mono'` (see applyEffect).
    id: 'subtract.subtract', label: 'Subtract signal', category: 'Combine',
    program: 'subtract', domain: 'sound', inputs: 2, in2: 'mono',
    args: ['subtract', '$IN', '$IN2', '$OUT', { p: 'chan', flag: '-c' }],
    params: [
      { name: 'chan', label: 'Channel', min: 1, max: 8, default: 1, step: 1, help: 'Which channel of the main sound the 2nd sound is subtracted from (1 = first). Must not exceed the main sound’s channel count.' },
    ],
    blurb: 'Sample-by-sample subtract the 2nd sound (mixed to mono) from one channel of the 1st — cancel shared material or take a difference.',
  },
];
