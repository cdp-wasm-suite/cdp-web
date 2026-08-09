// Effect entry for CDP's `housekeep` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'housekeep.split', label: 'Split channels', category: 'Mix',
    program: 'housekeep', domain: 'sound', multiOut: true, collect: '/in_c',
    // `housekeep chans 2` takes no outfile argument — it auto-names one mono
    // file per input channel (in_c1, in_c2, …), collected by prefix.
    args: ['chans', '2', '$IN'],
    params: [],
    blurb: 'Split a sound into its channels, one mono file each (left first) — a bank of sounds.',
  },
];
